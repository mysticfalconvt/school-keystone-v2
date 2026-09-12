// The iterative natural-language -> GraphQL pipeline and its domain prompt.
//
// Previously lived in ../SchoolDashboard/lib/communicator. Moved here so the
// pipeline sits next to the lists it queries, which removes the
// Keystone -> dashboard -> Keystone HTTP loop and lets generated queries run in
// the caller's own access context.
//
// The only structural change from the dashboard version: the GraphQL client is
// injected rather than imported as a singleton, because the caller-scoped
// executor closes over a single request's context and cannot be shared.
import type { Tool } from './types';
import type { CallerScopedGraphQL } from './graphqlExecutor';
import { lmStudio } from './lmStudio';

// Tool for evaluating query response quality
const EVALUATE_RESPONSE_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'evaluate_response',
    description:
      "Evaluate whether the current data and explanation fully answer the user's question.",
    parameters: {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          description:
            'Score from 1-10 indicating how well the question was answered (10 = perfect, 1 = not answered)',
        },
        is_complete: {
          type: 'boolean',
          description: 'Whether the answer is complete and satisfactory',
        },
        missing_information: {
          type: 'string',
          description:
            'What information is missing or needed for a complete answer (empty if complete)',
        },
        suggested_followup: {
          type: 'string',
          description:
            'A follow-up question to get the missing information (empty if complete)',
        },
      },
      required: ['score', 'is_complete'],
    },
  },
};

// Tool for identifying relevant schema types
const IDENTIFY_TYPES_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'identify_schema_types',
    description:
      "Identify which GraphQL types are needed to answer the user's question.",
    parameters: {
      type: 'object',
      properties: {
        types: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of GraphQL type names needed (e.g., ["User", "Post"])',
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of why these types are needed',
        },
      },
      required: ['types'],
    },
  },
};

// Tool for generating GraphQL query
const GRAPHQL_TOOL: Tool = {
  type: 'function',
  function: {
    name: 'generate_graphql_query',
    description:
      "Generate a valid GraphQL query based on the user question and available schema. The query should fetch all necessary data to answer the user's question.",
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The complete GraphQL query string including operation type, field selections, and any necessary arguments',
        },
        variables: {
          type: 'object',
          description: 'Optional variables for the GraphQL query',
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of why this query was chosen',
        },
      },
      required: ['query'],
    },
  },
};

export class QueryGeneratorService {
  // GraphQL access scoped to the requesting user. Supplied per request.
  constructor(private readonly graphql: CallerScopedGraphQL) {}

  // Token/character limits for context management
  private readonly MAX_RESULT_CHARS = 4000; // ~1000 tokens - more conservative
  private readonly MAX_TOKENS = 2000; // Max tokens for LLM responses
  private readonly MAX_ITERATIONS = 4; // Max follow-up queries
  private readonly MIN_SCORE_THRESHOLD = 6; // Minimum score to consider complete
  private readonly MAX_TOOL_ATTEMPTS = 2; // Retries when a model botches a tool call

  /**
   * Truncate large JSON results to fit within token limits
   */
  private truncateResults(
    results: any,
    maxChars: number = this.MAX_RESULT_CHARS,
  ): any {
    const jsonString = JSON.stringify(results, null, 2);

    if (jsonString.length <= maxChars) {
      return results;
    }

    console.log(
      `⚠️ Results too large (${jsonString.length} chars), truncating...`,
    );

    // If it's an array, truncate the array
    if (Array.isArray(results)) {
      const truncated = [];
      let currentLength = 2; // Start with "[]"

      for (const item of results) {
        const itemString = JSON.stringify(item, null, 2);
        if (currentLength + itemString.length + 2 > maxChars) {
          break;
        }
        truncated.push(item);
        currentLength += itemString.length + 2; // +2 for comma and newline
      }

      return {
        _truncated: true,
        _totalItems: results.length,
        _showingItems: truncated.length,
        data: truncated,
      };
    }

    // If it's an object with arrays, truncate the arrays
    if (typeof results === 'object' && results !== null) {
      const truncated: any = { _truncated: false };
      let totalSize = 0;

      for (const [key, value] of Object.entries(results)) {
        if (Array.isArray(value)) {
          // Truncate array to fit within max chars
          const truncatedArray = [];
          let arraySize = 0;

          for (const item of value) {
            const itemString = JSON.stringify(item, null, 2);
            if (totalSize + arraySize + itemString.length > maxChars) {
              break;
            }
            truncatedArray.push(item);
            arraySize += itemString.length;
          }

          if (truncatedArray.length < value.length) {
            truncated[key] = truncatedArray;
            truncated._truncated = true;
            truncated[`_${key}_total`] = value.length;
            truncated[`_${key}_showing`] = truncatedArray.length;
          } else {
            truncated[key] = value;
          }

          totalSize += arraySize;
        } else {
          truncated[key] = value;
        }
      }

      return truncated;
    }

    // Fallback: just truncate the string
    return {
      _truncated: true,
      _note: 'Results were too large and have been truncated',
      _preview: jsonString.substring(0, maxChars) + '...',
    };
  }

  /**
   * Parse the schema to extract a type summary (just type names and descriptions)
   * Excludes Mutation type since we only support queries
   */
  private getTypeSummary(schema: string): string {
    const lines = schema.split('\n');
    const summary: string[] = ['Available GraphQL Types:\n'];

    for (const line of lines) {
      // Match type definitions, but exclude Mutation
      const match = line.match(/^(type|input|enum|interface)\s+(\w+)/);
      if (match && match[2] !== 'Mutation') {
        summary.push(line.trim());
      }
    }

    return summary.join('\n');
  }

  /**
   * Extract specific types from the full schema
   * Always includes Query type and excludes Mutation type
   * Automatically includes related input types for filters/sorting
   */
  private extractTypes(schema: string, typeNames: string[]): string {
    const lines = schema.split('\n');
    const result: string[] = [];
    let inType = false;

    // Ensure Query is always included
    const typesToExtract = new Set(typeNames);
    typesToExtract.add('Query');

    // For each type, also include its related input types
    const relatedInputs = new Set<string>();
    for (const typeName of typeNames) {
      // Add common input patterns for this type
      relatedInputs.add(`${typeName}WhereInput`);
      relatedInputs.add(`${typeName}OrderByInput`);
      relatedInputs.add(`${typeName}WhereUniqueInput`);
      relatedInputs.add(`${typeName}ManyRelationFilter`);
    }

    // Merge related inputs into types to extract
    relatedInputs.forEach((inputType) => {
      typesToExtract.add(inputType);
    });

    // Always include common filter/utility types
    typesToExtract.add('OrderDirection');
    typesToExtract.add('QueryMode');
    typesToExtract.add('StringFilter');
    typesToExtract.add('StringNullableFilter');
    typesToExtract.add('IntNullableFilter');
    typesToExtract.add('BooleanFilter');
    typesToExtract.add('DateTimeFilter');
    typesToExtract.add('DateTimeNullableFilter');
    typesToExtract.add('IDFilter');
    typesToExtract.add('NestedStringFilter');

    for (const line of lines) {
      // Check if we're starting a new type definition
      const typeMatch = line.match(
        /^(type|input|enum|interface|scalar)\s+(\w+)/,
      );
      if (typeMatch && typeMatch[2]) {
        const typeName = typeMatch[2];

        // Always exclude Mutation type
        if (typeName === 'Mutation') {
          inType = false;
          continue;
        }

        if (typesToExtract.has(typeName)) {
          inType = true;
          result.push(line);
        } else {
          inType = false;
        }
        continue;
      }

      // If we're in a relevant type, add the line
      if (inType) {
        result.push(line);
        // Check if the type definition ends
        if (line.trim() === '}') {
          inType = false;
          result.push(''); // Add blank line between types
        }
      }
    }

    return result.join('\n');
  }

  /**
   * Step 1: Identify which schema types are relevant
   */
  async identifyRelevantTypes(
    question: string,
    model: string,
  ): Promise<{ types: string[]; reasoning: string }> {
    const schema = await this.graphql.getSchema();
    const typeSummary = this.getTypeSummary(schema);

    console.log('Type summary length:', typeSummary.length, 'characters');

    const systemPrompt = `You are a GraphQL schema analyzer. Given a user's question and a list of available GraphQL types, identify which types are needed to answer the question.`;

    const userPrompt = `${typeSummary}

User Question: "${question}"

Use the identify_schema_types tool to specify which types are needed.`;

    const response = await lmStudio.chatCompletionWithTools({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [IDENTIFY_TYPES_TOOL],
      tool_choice: 'required',
      temperature: 0.2,
      max_tokens: 500, // Type identification should be brief
    });

    const choice = response.choices[0];
    if (
      !choice ||
      !choice.message.tool_calls ||
      choice.message.tool_calls.length === 0
    ) {
      throw new Error('LLM did not identify types using the tool');
    }

    const toolCall = choice.message.tool_calls[0];
    if (!toolCall) {
      throw new Error('No tool call returned');
    }

    const args = this.parseToolArguments(toolCall.function.arguments) ?? {};

    console.log('Identified types:', args.types);
    console.log('Reasoning:', args.reasoning);

    return {
      types: Array.isArray(args.types) ? args.types : [],
      reasoning: args.reasoning || 'No reasoning provided',
    };
  }

  /**
   * Step 2: Generate a GraphQL query with only relevant types
   */
  async generateQuery(
    question: string,
    model: string,
    userId?: string,
    userName?: string,
  ): Promise<{
    query: string;
    variables?: Record<string, any>;
    reasoning: string;
  }> {
    // Step 1: Identify relevant types
    const { types } = await this.identifyRelevantTypes(question, model);

    // Step 2: Get full schema and extract only relevant types
    const fullSchema = await this.graphql.getSchema();
    const relevantSchema = this.extractTypes(fullSchema, types);

    console.log('Relevant schema length:', relevantSchema.length, 'characters');
    console.log('Relevant schema:\n', relevantSchema);

    // Step 3: Generate query with focused schema
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentDateTime = now.toISOString();

    // Build user context section if provided
    const userContextSection =
      userId || userName
        ? `
CURRENT USER CONTEXT (Teacher-focused):
${userId ? `- User ID: ${userId}` : ''}
${userName ? `- User Name: ${userName}` : ''}
- CRITICAL: The current user is a TEACHER unless specified otherwise
- When the teacher asks about "me", "my", "I", etc., use this information to filter queries as a TEACHER

Teacher Query Patterns (IMPORTANT):
- "my students" or "students in my class" → Use block1Students, block2Students, etc. fields where the current user is the teacher
- "my block 1 class" or "my period 1" → Use block1Students where current user is block1Teacher
- "my callbacks" → Filter callbacks where teacher = current user (callbacks are late assignments assigned by teachers)
- "callbacks I assigned" → Filter callbacks where teacher = current user
- "PBIS cards I gave" → Filter pbisCards where teacher = current user
- "my TA students" → Use taStudents where current user is taTeacher

Example queries for teachers:
- "Show my block 1 students" → query { user(where: { id: "${userId}" }) { block1Students { name } } }
- "My callbacks" → query { callbacks(where: { teacher: { id: { equals: "${userId}" } } }) { student { name } title } }
- "PBIS cards I gave" → query { pbisCards(where: { teacher: { id: { equals: "${userId}" } } }) { student { name } category } }
`
        : '';

    const systemPrompt = `You are a GraphQL query generator for a KeystoneJS GraphQL API. Given a user's natural language question and a GraphQL schema, your job is to generate a valid GraphQL query that will fetch the data needed to answer the question.

CURRENT DATE/TIME:
- Today's Date: ${currentDate}
- Current DateTime: ${currentDateTime}
- Use this information to calculate date ranges for queries like "last week", "this month", "yesterday", etc.
- For date comparisons, use ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ)
${userContextSection}

Important guidelines:
1. Generate syntactically correct GraphQL queries
2. Only use fields and types that exist in the provided schema
3. Include all necessary fields to answer the user's question
4. Use appropriate filters, sorting, and pagination if needed
5. Keep queries efficient - don't over-fetch data
6. CRITICAL: You must ONLY generate queries (query { ... }), NEVER mutations or subscriptions
7. If the user asks to create, update, or delete data, you must refuse and explain that only read operations are allowed
8. CRITICAL - Field Aliases: If you need to query the same field multiple times with different arguments, you MUST use aliases
   This applies to ALL fields: users, teachers, students, callbacks, pbisCards, etc.
   Example - WRONG: query { users(where: {...}) { id } users(where: {...}) { id } }
   Example - WRONG: query { teachers(where: {...}) { id } teachers(where: {...}) { id } }
   Example - CORRECT: query { students: users(where: {...}) { id } staff: users(where: {...}) { id } }
   Example - CORRECT: query { mathTeachers: teachers(where: {...}) { id } scienceTeachers: teachers(where: {...}) { id } }
   ALWAYS use descriptive aliases when querying the same field multiple times - this is REQUIRED by GraphQL

KeystoneJS Filter Syntax (IMPORTANT):
- For boolean fields, use: { fieldName: { equals: true } } NOT { fieldName: true }
- For string fields, use: { fieldName: { equals: "value" } } or { contains: "value" }
- CRITICAL - Case-Insensitive Text Search: ALWAYS use mode: "insensitive" for string filters to make searches case-insensitive
  Example: { name: { contains: "john", mode: insensitive } }
  Example: { name: { equals: "Smith", mode: insensitive } }
  This ensures searches work regardless of capitalization (e.g., "John", "JOHN", "john" all match)
- For number comparisons: { fieldName: { gt: 5, lt: 10 } }
- For sorting, use: orderBy: [{ fieldName: asc }] or orderBy: [{ fieldName: desc }]
- For limiting results: take: 10
- For skipping results: skip: 5
- CRITICAL - Relationship Filters: When filtering on relationships, you MUST use "some", "none", or "every"
  Example: { students: { some: { name: { contains: "John", mode: insensitive } } } }
  Example: { teacher: { name: { equals: "Smith", mode: insensitive } } } // for single relationships
  NEVER: { students: { name: { contains: "John" } } } // WRONG - missing "some"

CRITICAL - User Query Types (MUST UNDERSTAND):
- user (singular) uses UserWhereUniqueInput - ONLY accepts unique fields like { id: "..." }
  WRONG: user(where: { name: "John", isTeacher: true }) ← name and isTeacher are NOT unique fields
  CORRECT: user(where: { id: "123" }) ← only use for unique lookups by ID
- users (plural) uses UserWhereInput - accepts filtering fields like name, isStaff, isStudent, etc.
  CORRECT: users(where: { name: { contains: "John", mode: insensitive }, isStaff: { equals: true } })
- When filtering by name, isStaff, isStudent, or any non-unique field, ALWAYS use users (plural), NEVER user (singular)
- People here say "teacher" to mean anyone who works at the school, so DEFAULT to isStaff
  DEFAULT: users(where: { isStaff: { equals: true } })
  isTeacher does exist and marks classroom teachers specifically (those with a TA group or
  assigned classes - roughly half of staff). Use it ONLY when the question clearly means
  classroom teachers as distinct from other staff.

Domain-Specific Rules (CRITICAL):
- ALL users (teachers, staff, students) are in the same "users" table
- When asking about TEACHERS or STAFF: ALWAYS filter by { isStaff: { equals: true } } using users (plural)
- When asking about STUDENTS: ALWAYS filter by { isStudent: { equals: true } } using users (plural)
- CRITICAL: "teacher" in a question usually means any employee, so default to isStaff: { equals: true }. Only use isTeacher when the question means classroom teachers as opposed to other staff.
- CRITICAL: If the question asks about a student (e.g., "what teachers does [name] have"), you MUST:
  1. Use users (plural) not user (singular) when filtering by name
  2. Combine name filter with isStudent filter: { isStudent: { equals: true }, name: { contains: "name", mode: insensitive } }

Callback Assignment Terminology (CRITICAL):
- "Callbacks" are LATE ASSIGNMENTS or MISSING WORK assigned by teachers to students
- Terms that mean callbacks: "late work", "late assignments", "callback assignments", "missing work", "callbacks"
- Callbacks have a teacher (who assigned it) and student (who needs to complete it)

Callback Query Rules for Teachers:
- When a TEACHER asks "my callbacks" or "callbacks I assigned", query callbacks table with teacher filter
- CORRECT: query { callbacks(where: { teacher: { id: { equals: "..." } } }) { id title student { name } dateAssigned } }
- callbackCount on User is for STUDENTS (callbacks assigned TO them), not teachers
- For counting teacher's callbacks: query callbacks table with teacher filter and count results

PBIS Card Rules:
- Card counts on User are RELATIONSHIP counts, computed live. They are always accurate.
  - studentPbisCardsCount = cards a student RECEIVED
  - teacherPbisCardsCount = cards a staff member GAVE
  - staffPbisCardsReceivedCount / staffPbisCardsGivenCount = staff-to-staff cards
- Each accepts the same filters as the underlying list, so date ranges go inside it:
  studentPbisCardsCount(where: { dateGiven: { gte: "2026-09-01T00:00:00.000Z" } })
  With no argument it counts every card on record.
- CRITICAL: these counts CANNOT be used in orderBy. UserOrderByInput has no card
  fields at all. There is no way to sort users by cards in the query.
- So for "who has the most cards" style questions, DO NOT try to sort. Fetch the
  candidates with their count and let the explanation step find the maximum:
  query { users(where: { isStudent: { equals: true } }) { id name studentPbisCardsCount } }
- When a TEACHER asks "how many PBIS cards have I given", use teacherPbisCardsCount,
  or query the pbisCards list filtered by teacher if you need the individual cards.
- Do not invent stored count fields such as PbisCardCount, YearPbisCount or
  taPbisCardCount. They were removed; only the relationship counts above exist.

Counting and Ranking Rules:
- Prefer a *Count field with a where filter over fetching rows and counting them
  yourself. counts are computed by the database and are exact; counting rows in a
  large JSON payload by eye is unreliable and has produced wrong answers.
- Read the field description before using a count. Several counts mean "all time"
  unless you pass a filter - asking for "open" or "outstanding" and then using an
  unfiltered count is a silent error that returns a plausible but wrong number.
- GraphQL here cannot GROUP BY. There is no way to ask "which description/category
  /teacher appears most often" in one query. If a question needs grouping, either
  ask for counts of specific candidate values one at a time, or say plainly that
  the data cannot be grouped in a single query and offer the closest thing you can
  answer exactly.
- Never present a ranking derived from scanning many rows as if it were exact.

Name and Display Rules:
- The name field for users includes BOTH first and last name (e.g., "John Smith")
- For searches: use { name: { contains: "John", mode: insensitive } } to find partial matches
- ALWAYS use mode: insensitive for all name searches to handle case variations
- For teacher/student relationships: questions like "what teachers does John Smith have" mean checking block1Teacher, block2Teacher, etc.
- For class rosters: questions like "what students does Mr Smith have" mean checking block1Students, block2Students, etc.

Example correct queries:
query { users(where: { isStaff: { equals: true } }, orderBy: [{ name: asc }], take: 10) { id name callbackCount } }
query { users(where: { isStudent: { equals: true } }) { id name studentPbisCardsCount } }
query { users(where: { isStudent: { equals: true }, name: { contains: "Korbin", mode: insensitive } }, take: 1) { id name block1Teacher { id name } block2Teacher { id name } } }
query { callbacks(where: { student: { name: { contains: "John", mode: insensitive } } }) { id student { name } title } }
query { pbisCards(where: { teacher: { id: { equals: "123" } } }) { id student { name } category dateGiven } }
query { students: users(where: { isStudent: { equals: true } }) { id name } staff: users(where: { isStaff: { equals: true } }) { id name } }
query { user(where: { id: "123" }) { id name } }
query { users(where: { name: { contains: "Smith", mode: insensitive }, isStaff: { equals: true } }) { id name } }

GraphQL Schema:
${relevantSchema}`;

    const userPrompt = `Generate a GraphQL query to answer this question: "${question}"

Use the generate_graphql_query tool to provide your answer.`;

    // Smaller local models regularly botch the tool call — no tool_calls at all,
    // malformed JSON arguments, or arguments that omit/nest the "query" field.
    // Retry once with the failure spelled out before giving up.
    let lastFailure = '';

    for (let attempt = 1; attempt <= this.MAX_TOOL_ATTEMPTS; attempt++) {
      const attemptPrompt =
        attempt === 1
          ? userPrompt
          : `${userPrompt}

Your previous attempt failed: ${lastFailure}
Call the generate_graphql_query tool with a "query" argument whose value is the complete GraphQL query as a single string.`;

      const response = await lmStudio.chatCompletionWithTools({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: attemptPrompt },
        ],
        tools: [GRAPHQL_TOOL],
        tool_choice: 'required',
        temperature: 0.2,
        max_tokens: 1000, // Queries should be concise
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        lastFailure = 'the model replied without calling the tool';
        console.warn(`⚠️ Query generation attempt ${attempt}: ${lastFailure}`);
        continue;
      }

      const args = this.parseToolArguments(toolCall.function.arguments);
      const queryArgs = this.extractQueryArgs(args);
      if (!queryArgs) {
        lastFailure = `the tool call did not include a "query" string (arguments: ${String(
          toolCall.function.arguments,
        ).substring(0, 300)})`;
        console.warn(`⚠️ Query generation attempt ${attempt}: ${lastFailure}`);
        continue;
      }

      // Validate that the generated GraphQL is a query, not a mutation or subscription
      if (!this.isQueryOperation(queryArgs.query)) {
        throw new Error(
          'Operation not allowed. Only read operations (queries) are permitted. Mutations and subscriptions are not supported.',
        );
      }

      return {
        query: queryArgs.query,
        variables: queryArgs.variables,
        reasoning: queryArgs.reasoning || 'No reasoning provided',
      };
    }

    throw new Error(
      `The model "${model}" did not return a usable GraphQL query after ${this.MAX_TOOL_ATTEMPTS} attempts: ${lastFailure}`,
    );
  }

  /**
   * Tool-call arguments are supposed to be a JSON string, but local models
   * sometimes double-encode them or emit invalid JSON. Returns null when the
   * arguments can't be parsed.
   */
  private parseToolArguments(raw: unknown): any {
    if (raw && typeof raw === 'object') {
      return raw;
    }
    if (typeof raw !== 'string') {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') {
        // Double-encoded arguments
        try {
          return JSON.parse(parsed);
        } catch {
          return null;
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Pull the generated query out of the tool arguments, tolerating the wrapper
   * shapes and field aliases models use instead of a bare { query, ... }.
   */
  private extractQueryArgs(args: any): {
    query: string;
    variables?: Record<string, any>;
    reasoning?: string;
  } | null {
    if (!args || typeof args !== 'object') {
      return null;
    }

    const containers = [args, args.arguments, args.parameters, args.input];
    for (const container of containers) {
      if (!container || typeof container !== 'object') {
        continue;
      }
      const value =
        container.query ?? container.graphql_query ?? container.graphqlQuery;
      if (typeof value === 'string' && value.trim()) {
        return {
          query: value.trim(),
          variables: container.variables,
          reasoning: container.reasoning,
        };
      }
    }

    return null;
  }

  /**
   * Validate that a GraphQL operation is a query (not mutation or subscription)
   */
  private isQueryOperation(graphqlString: string): boolean {
    // Remove comments and normalize whitespace
    const normalized = graphqlString
      .replace(/#.*/g, '') // Remove comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Check if it starts with 'mutation' or 'subscription' (case insensitive)
    if (/^\s*(mutation|subscription)\s*[{\(]/i.test(normalized)) {
      return false;
    }

    // If it starts with 'query' keyword, it's valid
    if (/^\s*query\s*[{\(]/i.test(normalized)) {
      return true;
    }

    // If it starts with '{', it's a shorthand query (allowed)
    if (/^\s*\{/.test(normalized)) {
      return true;
    }

    // Default to false for safety
    return false;
  }

  /**
   * Generate an explanation of query results
   */
  async explainResults(
    question: string,
    query: string,
    results: any,
    model: string,
    // Must be the same limit processQuery derived from the model's context
    // window. Without it this fell back to MAX_RESULT_CHARS and re-truncated
    // data that had already been sized correctly, so the dynamic limit never
    // took effect and every result was cut to 4000 chars regardless of model.
    maxChars: number = this.MAX_RESULT_CHARS,
  ): Promise<string> {
    // Check if already truncated, if not truncate
    const alreadyTruncated = results._truncated === true;
    const originalSize = JSON.stringify(results).length;

    const truncatedResults = alreadyTruncated
      ? results
      : this.truncateResults(results, maxChars);
    const wasTruncated = truncatedResults._truncated === true;
    const truncatedSize = JSON.stringify(truncatedResults).length;

    console.log(
      `Results size: ${originalSize} chars -> ${truncatedSize} chars (truncated: ${wasTruncated}, already: ${alreadyTruncated})`,
    );

    const systemPrompt = `You are a helpful assistant that explains data to teachers. Given a user's question, the GraphQL query that was executed, and the results, provide a clear, concise, natural language explanation of the answer.

Guidelines:
1. Directly answer the user's question
2. Be specific and cite actual data from the results (names, titles, descriptions, etc.)
3. Keep it concise but complete
4. Use natural, conversational language
5. If the results are empty or don't contain relevant data, clearly state that
6. IMPORTANT: Do NOT include or mention any IDs (user IDs, record IDs, etc.) in your response - users don't need to see internal identifiers
7. IMPORTANT: Do NOT include email addresses in your response unless the user specifically asked for emails
8. CRITICAL: Format your response using Markdown - use headers (##, ###), lists (-, *), **bold**, and proper formatting for readability

Name Display Rules:
9. When displaying names, use FIRST NAME ONLY for brevity and friendliness (e.g., "John" not "John Smith")
10. Extract the first name from the full name field (names are stored as "FirstName LastName")

Terminology Rules:
11. Use "callback assignment" or "late assignment" instead of just "callback" when explaining to make it clear
12. Example: "John has 3 callback assignments" or "Sarah has 2 late assignments" (NOT "John has 3 callbacks")
13. PBIS cards can be referred to as "PBIS cards" or "positive behavior cards"
${
  wasTruncated
    ? `14. CRITICAL - THE RESULTS ARE INCOMPLETE. They were cut to fit, and the
    rows you were given are an arbitrary slice, not the top or first ones by any
    meaningful order. Therefore you MUST NOT state or imply a maximum, minimum,
    "most", "least", "top", "best", "worst", or any ranking or total. Say plainly
    that the data was too large to show in full, report only what is visible and
    label it as a partial sample, and suggest narrowing the question (a specific
    person, class, or date range) to get a reliable answer.`
    : ''
}`;

    const userPrompt = `User's Question: "${question}"

GraphQL Query Executed:
\`\`\`graphql
${query}
\`\`\`

Query Results${wasTruncated ? ' (truncated for brevity)' : ''}:
\`\`\`json
${JSON.stringify(truncatedResults, null, 2)}
\`\`\`

Please explain what this data tells us in answer to the user's question. Format your response in Markdown with appropriate headers, lists, and formatting for readability.`;

    const explanation = await lmStudio.complete(
      model,
      userPrompt,
      systemPrompt,
      0.7,
      this.MAX_TOKENS, // Add max_tokens parameter
    );

    return explanation.trim();
  }

  /**
   * Evaluate if the response adequately answers the question
   */
  async evaluateResponse(
    originalQuestion: string,
    explanation: string,
    allData: any[],
    model: string,
  ): Promise<{
    score: number;
    isComplete: boolean;
    missingInfo?: string;
    suggestedFollowup?: string;
  }> {
    const systemPrompt = `You are a quality evaluator for question-answering systems. Your job is to determine if a response adequately answers the user's original question.

CRITICAL RULES:
1. If the response is incomplete (is_complete = false), you MUST provide a suggested_followup question
2. If results are empty or no data found, suggest trying alternate spellings, checking if the person is a student vs staff, or broadening the search
3. If data exists but doesn't answer the question, suggest what additional information is needed
4. The suggested_followup should be a clear, actionable question that can be used to refine the search`;

    const isEmpty =
      allData.length === 0 ||
      (allData.length === 1 &&
        (JSON.stringify(allData[0]).length < 50 ||
          JSON.stringify(allData[0]) === '{}' ||
          (Array.isArray(allData[0]) && allData[0].length === 0)));

    const userPrompt = `Original Question: "${originalQuestion}"

Current Explanation:
${explanation}

Available Data Summary:
${JSON.stringify(allData, null, 2).substring(0, 2000)}
${
  isEmpty
    ? '\n⚠️ WARNING: The data appears to be empty or no results were found. Consider suggesting alternate search strategies.'
    : ''
}

Evaluate whether this explanation fully answers the original question. Use the evaluate_response tool.
${
  isEmpty
    ? 'IMPORTANT: Since no data was found, you MUST provide a suggested_followup with alternative search strategies.'
    : ''
}`;

    const response = await lmStudio.chatCompletionWithTools({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      tools: [EVALUATE_RESPONSE_TOOL],
      tool_choice: 'required',
      temperature: 0.3,
      max_tokens: 500,
    });

    const choice = response.choices[0];
    if (
      !choice ||
      !choice.message.tool_calls ||
      choice.message.tool_calls.length === 0
    ) {
      // If evaluation fails, assume it's complete
      return { score: 7, isComplete: true };
    }

    const toolCall = choice.message.tool_calls[0];
    if (!toolCall) {
      return { score: 7, isComplete: true };
    }

    const args = this.parseToolArguments(toolCall.function.arguments);
    if (!args || typeof args !== 'object') {
      // Unparseable evaluation - assume it's complete rather than failing the request
      return { score: 7, isComplete: true };
    }

    console.log(
      `Evaluation - Score: ${args.score}/10, Complete: ${args.is_complete}`,
    );
    if (!args.is_complete) {
      console.log(`Missing: ${args.missing_information}`);
      console.log(
        `Suggested followup: ${args.suggested_followup || '(none provided)'}`,
      );
    }

    // If incomplete but no followup provided, generate one based on missing info
    let suggestedFollowup = args.suggested_followup;
    if (!args.is_complete && !suggestedFollowup) {
      if (args.missing_information) {
        // Try to create a followup from the missing information
        suggestedFollowup = `Find ${args.missing_information.toLowerCase()}`;
      } else {
        // Generic followup if we can't determine what's missing
        suggestedFollowup = `Search for more information related to: ${originalQuestion}`;
      }
      console.log(`⚠️ Generated fallback followup: ${suggestedFollowup}`);
    }

    return {
      score: args.score,
      isComplete: args.is_complete,
      missingInfo: args.missing_information,
      suggestedFollowup,
    };
  }

  /**
   * Calculate dynamic truncation limit based on model context length
   */
  private calculateTruncationLimit(modelContextLength?: number): number {
    if (!modelContextLength || modelContextLength === 0) {
      // Use default if context length unknown
      return this.MAX_RESULT_CHARS;
    }

    // Reserve space for:
    // - System prompt (~1000 tokens)
    // - User prompt/question (~200 tokens)
    // - GraphQL query (~500 tokens)
    // - LLM response (~2000 tokens from MAX_TOKENS)
    // - Safety buffer (20%)
    const reservedTokens = 1000 + 200 + 500 + this.MAX_TOKENS;
    const safetyBuffer = 0.2; // 20% buffer
    const availableTokens = modelContextLength - reservedTokens;
    const tokensForResults = availableTokens * (1 - safetyBuffer);

    // Rough conversion: 1 token ≈ 4 characters
    const maxChars = Math.max(1000, Math.floor(tokensForResults * 4));

    console.log(
      `Dynamic truncation: context=${modelContextLength}, available=${tokensForResults} tokens, maxChars=${maxChars}`,
    );

    return maxChars;
  }

  /**
   * Complete flow with iterative refinement: Generate query, execute, evaluate, and refine if needed
   */
  async processQuery(
    question: string,
    model: string,
    userId?: string,
    userName?: string,
  ): Promise<{
    query: string;
    variables?: Record<string, any>;
    reasoning: string;
    data: any;
    explanation: string;
    iterations?: number;
    evaluationScore?: number;
  }> {
    // Get model context length for dynamic truncation
    let modelContextLength: number | undefined;
    try {
      const models = await lmStudio.getModelsWithLimits();
      const currentModel = models.find((m) => m.id === model);
      modelContextLength = currentModel?.max_context_length;
      console.log(
        `Model ${model} context length: ${modelContextLength || 'unknown'}`,
      );
    } catch (error) {
      console.warn('Could not fetch model context length:', error);
    }

    let currentQuestion = question;
    let allQueries: string[] = [];
    let allData: any[] = [];
    let finalExplanation = '';
    let iteration = 0;

    while (iteration < this.MAX_ITERATIONS) {
      iteration++;
      console.log(`\n=== Iteration ${iteration} ===`);
      console.log(`Question: ${currentQuestion}`);

      // Step 1: Generate GraphQL query
      let generated: {
        query: string;
        variables?: Record<string, any>;
        reasoning: string;
      };
      try {
        generated = await this.generateQuery(
          currentQuestion,
          model,
          userId,
          userName,
        );
      } catch (error) {
        // A follow-up iteration failing shouldn't throw away the answer we
        // already built from earlier iterations.
        if (allData.length > 0 && finalExplanation) {
          console.warn(
            `⚠️ Follow-up query generation failed on iteration ${iteration}, returning earlier results:`,
            error,
          );
          iteration -= 1; // this iteration produced nothing
          break;
        }
        throw error;
      }

      const { query, variables, reasoning } = generated;
      allQueries.push(query);
      console.log('Generated query:', query);

      // Step 2: Execute the query
      const result = await this.graphql.query({ query, variables });
      console.log('Result:', result);
      if (result.errors) {
        // Check if it's a parse or validation error that we might be able to fix.
        // Parse failures mean the document never made it past the tokenizer, so
        // nothing downstream was even analysed - they are worth a retry too.
        const retryableError = result.errors.find(
          (e) =>
            e.extensions?.code === 'GRAPHQL_PARSE_FAILED' ||
            e.message.includes('Syntax Error') ||
            e.extensions?.code === 'GRAPHQL_VALIDATION_FAILED' ||
            e.message.includes('conflict') ||
            e.message.includes('differing arguments') ||
            e.message.includes('is not defined by type') ||
            e.message.includes('UserWhereUniqueInput'),
        );

        // If it's a retryable error and we have iterations left, retry with error context
        if (retryableError && iteration < this.MAX_ITERATIONS) {
          console.log(
            `⚠️ GraphQL ${
              retryableError.message.includes('Syntax Error')
                ? 'parse'
                : 'validation'
            } error detected, retrying with error context...`,
          );
          console.log('Error:', retryableError.message);

          // Build specific error guidance based on error type
          let errorGuidance = '';
          if (
            retryableError.extensions?.code === 'GRAPHQL_PARSE_FAILED' ||
            retryableError.message.includes('Syntax Error')
          ) {
            const loc = retryableError.locations?.[0];
            const where = loc
              ? ` The parser stopped at line ${loc.line}, column ${loc.column}.`
              : '';
            errorGuidance = `CRITICAL: Your query is not valid GraphQL - it failed to parse, so none of it ran.${where} Common causes: unbalanced { } or ( ), a trailing comma, a missing field name, or the query being cut off before it finished. Rewrite the whole query from scratch as ONE complete, syntactically valid query operation. Do not send a fragment or a partial query.`;
          } else if (retryableError.message.includes('UserWhereUniqueInput')) {
            errorGuidance = `CRITICAL ERROR: You used user (singular) with fields that don't exist in UserWhereUniqueInput. UserWhereUniqueInput ONLY accepts unique fields like { id: "..." }. When filtering by name, isStaff, isStudent, or any non-unique field, you MUST use users (plural) instead. Also, "teacher" in a question usually means any employee, so prefer isStaff unless the question specifically means classroom teachers.`;
          } else if (
            retryableError.message.includes('conflict') ||
            retryableError.message.includes('differing arguments')
          ) {
            // Extract the field name from the error message
            const fieldMatch = retryableError.message.match(/Fields "(\w+)"/);
            const fieldName = fieldMatch ? fieldMatch[1] : 'the same field';
            errorGuidance = `CRITICAL: You queried "${fieldName}" multiple times with different arguments. GraphQL requires aliases when querying the same field multiple times. Use descriptive aliases like "first: ${fieldName}(...)" and "second: ${fieldName}(...)" or more descriptive names based on the filter (e.g., "students: users(...)" and "staff: users(...)").`;
          } else if (
            retryableError.message.includes('is not defined by type')
          ) {
            errorGuidance = `The field you used doesn't exist in that input type. Check the schema and use the correct field name and input type. Remember: user (singular) only accepts unique fields like id, while users (plural) accepts filtering fields.`;
          }

          // Update the question to include the error context
          currentQuestion = `${currentQuestion}\n\nIMPORTANT: The previous query failed with this error: "${retryableError.message}". ${errorGuidance} Please fix the query to resolve this issue.`;
          continue; // Retry with updated question
        }

        // Otherwise, throw the error
        throw new Error(
          `GraphQL query failed: ${result.errors
            .map((e) => e.message)
            .join(', ')}`,
        );
      }

      allData.push(result.data);

      // Step 3: Generate explanation with all accumulated data
      // Important: Truncate combined data to avoid token overflow
      let combinedData =
        allData.length === 1 ? allData[0] : { iteration_results: allData };

      // Calculate dynamic truncation limit based on model context
      const truncationLimit = this.calculateTruncationLimit(modelContextLength);

      // Always truncate before sending to LLM with dynamic limit
      const dataToExplain = this.truncateResults(combinedData, truncationLimit);

      finalExplanation = await this.explainResults(
        question, // Use original question
        allQueries.join('\n---\n'),
        dataToExplain,
        model,
        truncationLimit,
      );

      // Step 4: Evaluate if we have a complete answer
      if (iteration < this.MAX_ITERATIONS) {
        const evaluation = await this.evaluateResponse(
          question,
          finalExplanation,
          allData,
          model,
        );

        // If complete or score is good enough, stop
        if (
          evaluation.isComplete ||
          evaluation.score >= this.MIN_SCORE_THRESHOLD
        ) {
          console.log(`✓ Answer is complete (score: ${evaluation.score}/10)`);
          return {
            query: allQueries.join('\n---\n'),
            variables,
            reasoning,
            data: combinedData,
            explanation: finalExplanation,
            iterations: iteration,
            evaluationScore: evaluation.score,
          };
        }

        // If not complete, prepare follow-up question
        if (evaluation.suggestedFollowup) {
          console.log(`↻ Needs refinement - following up...`);
          currentQuestion = evaluation.suggestedFollowup;
        } else {
          // Generate a fallback followup based on missing info
          if (evaluation.missingInfo) {
            currentQuestion = `Find ${evaluation.missingInfo.toLowerCase()}`;
            console.log(`↻ Generated fallback followup: ${currentQuestion}`);
          } else {
            // Last resort: try with isStudent filter if we haven't already
            const hasStudentFilter = allQueries.some((q) =>
              q.includes('isStudent'),
            );
            if (
              !hasStudentFilter &&
              question.toLowerCase().includes('student')
            ) {
              currentQuestion = `${question} (make sure to search for students only)`;
              console.log(`↻ Adding student filter to followup`);
            } else {
              console.log(`⚠ Incomplete but no clear followup - stopping`);
              break;
            }
          }
        }
      }
    }

    console.log(`✓ Max iterations reached (${this.MAX_ITERATIONS})`);

    // Return final results
    const combinedData =
      allData.length === 1 ? allData[0] : { iteration_results: allData };
    return {
      query: allQueries.join('\n---\n'),
      variables: undefined,
      reasoning: 'Multi-step query process',
      data: combinedData,
      explanation: finalExplanation,
      iterations: iteration,
    };
  }
}

// No singleton: each request builds its own instance around the caller's
// Keystone context.
export function createQueryGenerator(
  graphql: CallerScopedGraphQL,
): QueryGeneratorService {
  return new QueryGeneratorService(graphql);
}
