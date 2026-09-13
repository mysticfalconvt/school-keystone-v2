// Tests for the multi-step pipeline changes.
//
// The loop can now chain data: a generated query's results are carried into the
// next generation prompt, and the model can say "this query only fetches
// something I need first" rather than having that intent survive only as prose
// in the evaluator's suggested follow-up.
//
// What is covered here is the machinery, not the model's judgement: which
// questions trigger the collection-date prefetch, how prior steps are rendered
// and bounded, how the lookup signal is parsed, and how the two budgets are
// spent. Whether the model uses any of it well is a question for real
// questions against a real endpoint.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { lmStudio } from '../lib/communicator/lmStudio';
import {
  QueryGeneratorService,
  type PriorStep,
} from '../lib/communicator/queryGenerator';

// No endpoint means lmStudio throws before it can reach the network, which
// processQuery already tolerates. Set explicitly so the suite cannot start
// talking to whatever happens to be in the environment.
delete process.env.LM_STUDIO_ENDPOINT;

/** Stand-in for CallerScopedGraphQL: records queries, replays canned answers. */
function fakeGraphql(responses: any[] = []) {
  const calls: string[] = [];
  let next = 0;
  return {
    calls,
    async query({ query }: { query: string }) {
      calls.push(query);
      return responses[next++] ?? { data: {} };
    },
    async getSchema() {
      return 'type Query { users: [User] }\ntype User { id: ID }';
    },
  };
}

function build(responses: any[] = []) {
  const graphql = fakeGraphql(responses);
  const service = new QueryGeneratorService(graphql as any);
  return { service, graphql, priv: service as any };
}

/** processQuery is chatty; keep the reporter readable. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const { log, warn } = console;
  console.log = () => {};
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

describe('collection-scoped detection', () => {
  const { priv } = build();
  const matches = (q: string) => priv.COLLECTION_SCOPED.test(q);

  test('matches the phrasings that mean a collection run', () => {
    for (const q of [
      'how many cards since the last collection',
      'who got the most cards this collection',
      'cards given in the latest collection',
      'what happened in the previous collection',
      'how many cards in the current collection',
      'totals for this collection period',
      'what did the last collection run count',
      // Real question that missed: the qualifier and the noun are not adjacent.
      // The model recovered by asking for the dates itself, which cost a model
      // call the seed exists to save.
      'which teacher had the most cards given in the last pbis collection',
      'who got the most cards in this pbis collection',
    ]) {
      assert.ok(matches(q), `should have matched: ${q}`);
    }
  });

  test('leaves unrelated questions alone', () => {
    // This runs on every request before anything else, so a loose pattern puts
    // an extra query on questions that have nothing to do with collections.
    for (const q of [
      'how many callbacks does James have',
      'who gave the most PBIS cards',
      'show my block 1 students',
      'how many cards did Michael Ingram give in September',
      'list the students with open callbacks',
      // The qualifier has to actually be qualifying the collection.
      'this student collected the most cards last year',
    ]) {
      assert.ok(!matches(q), `should not have matched: ${q}`);
    }
  });
});

describe('questions with nothing to answer', () => {
  const { priv } = build();
  const contentless = (q: string) => priv.hasNoAnswerableContent(q);

  test('recognises greetings and pleasantries', () => {
    for (const q of [
      'hi',
      'Hello!',
      'hey there'.replace(' there', ''),
      'good morning',
      'thanks',
      'thank you',
      'ok cool',
      'yes',
      '   ',
      '???',
      'test',
    ]) {
      assert.ok(contentless(q), `should have been contentless: ${JSON.stringify(q)}`);
    }
  });

  test('never swallows a real question', () => {
    // Refusing a real question would be far worse than running the loop on a
    // greeting, so this is the direction that matters. The token set contains
    // no domain words, which is what makes it safe.
    for (const q of [
      'hi, who gave the most cards',
      'good morning, how many callbacks are open',
      'thanks - can you also show my TA students',
      'no callbacks',
      'is the test score recorded',
      'which TA has the most cards',
      'ok so who is missing work',
      'students',
    ]) {
      assert.ok(!contentless(q), `should NOT have been contentless: ${q}`);
    }
  });

  test('answers without entering the loop', async () => {
    const { service, graphql } = build();
    let generated = 0;
    service.generateQuery = (async () => {
      generated++;
      return { query: 'query { a }', reasoning: '', needsFollowup: false };
    }) as any;

    const result = await quietly(() => service.processQuery('hi', 'm'));

    assert.equal(generated, 0, 'no model call');
    assert.equal(graphql.calls.length, 0, 'no database call');
    assert.equal(result.iterations, 0);
    assert.equal(result.query, '');
    assert.equal(result.data, null);
    assert.match(result.explanation, /ask me about/i);
  });
});

describe('the collection date prefetch', () => {
  test('fetches the two most recent runs for a scoped question', async () => {
    const dates = {
      data: {
        pbisCollectionDates: [
          { id: '2', collectionDate: '2026-09-11T00:00:00.000Z' },
          { id: '1', collectionDate: '2026-09-04T00:00:00.000Z' },
        ],
      },
    };
    const { priv, graphql } = build([dates]);

    const step: PriorStep | null = await quietly(() =>
      priv.seedCollectionDates('how many cards since the last collection'),
    );

    assert.ok(step);
    assert.match(step.query, /pbisCollectionDates/);
    // Two, not one: a collection period is a range and needs both ends.
    assert.match(step.query, /take: 2/);
    assert.match(step.query, /collectionDate: desc/);
    assert.deepEqual(step.data, dates.data);
    assert.ok(step.note);
    assert.equal(graphql.calls.length, 1);
  });

  test("treats a card question scoped to a week as a collection question", async () => {
    // "This week's cards" means the collection period here, not a calendar week.
    const { priv, graphql } = build([{ data: { pbisCollectionDates: [] } }]);
    const step = await quietly(() =>
      priv.seedCollectionDates('how many pbis cards were given this week'),
    );
    assert.ok(step);
    assert.equal(graphql.calls.length, 1);
  });

  test('leaves a non-card question scoped to a week alone', async () => {
    // "Callbacks assigned this week" really does mean a calendar week.
    const { priv, graphql } = build();
    const step = await quietly(() =>
      priv.seedCollectionDates('how many callbacks were assigned this week'),
    );
    assert.equal(step, null);
    assert.equal(graphql.calls.length, 0);
  });

  test('costs nothing on an unrelated question', async () => {
    const { priv, graphql } = build();
    const step = await quietly(() =>
      priv.seedCollectionDates('who gave the most PBIS cards'),
    );
    assert.equal(step, null);
    assert.equal(graphql.calls.length, 0);
  });

  test('a failed prefetch does not fail the question', async () => {
    const { priv } = build([{ errors: [{ message: 'boom' }] }]);
    const step = await quietly(() =>
      priv.seedCollectionDates('cards this collection'),
    );
    assert.equal(step, null);
  });

  test('a thrown prefetch does not fail the question', async () => {
    const service = new QueryGeneratorService({
      async query() {
        throw new Error('connection refused');
      },
    } as any);
    const step = await quietly(() =>
      (service as any).seedCollectionDates('cards this collection'),
    );
    assert.equal(step, null);
  });
});

describe('rendering prior steps', () => {
  const { priv } = build();

  test('renders nothing when there are no steps', () => {
    assert.equal(priv.renderPriorSteps([]), '');
  });

  test('shows each query with its result', () => {
    const out = priv.renderPriorSteps([
      { query: 'query { a }', data: { a: 1 } },
      { query: 'query { b }', data: { b: 2 }, note: 'fetched automatically' },
    ]);
    assert.match(out, /Step 1/);
    assert.match(out, /query \{ a \}/);
    assert.match(out, /"a": 1/);
    assert.match(out, /Step 2 - fetched automatically/);
    assert.match(out, /"b": 2/);
  });

  test('bounds a large result', () => {
    // Prior results share the context window with the schema, so an unbounded
    // step would crowd out the thing it is there to inform.
    const big = { users: Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `user ${i}` })) };
    const raw = JSON.stringify(big, null, 2);
    const out = priv.renderPriorSteps([{ query: 'query { users }', data: big }]);

    assert.ok(raw.length > 50000, 'fixture should be genuinely large');
    assert.ok(
      out.length < raw.length / 10,
      `rendered ${out.length} chars from a ${raw.length} char result`,
    );
    assert.match(out, /_truncated/);
  });
});

describe('parsing the lookup signal', () => {
  const { priv } = build();
  const extract = (args: any) => priv.extractQueryArgs(args);

  test('reads a real boolean', () => {
    const got = extract({ query: 'query { a }', needs_followup: true, followup_reason: 'need the date' });
    assert.equal(got.needsFollowup, true);
    assert.equal(got.followupReason, 'need the date');
  });

  test('reads the string form models emit', () => {
    assert.equal(extract({ query: 'query { a }', needs_followup: 'true' }).needsFollowup, true);
  });

  test('defaults to false when absent', () => {
    assert.equal(extract({ query: 'query { a }' }).needsFollowup, false);
  });

  test('is not fooled by a non-empty string that means false', () => {
    assert.equal(extract({ query: 'query { a }', needs_followup: 'false' }).needsFollowup, false);
  });

  test('finds it inside the wrapper shapes models use', () => {
    const got = extract({ arguments: { query: 'query { a }', needs_followup: true } });
    assert.equal(got.needsFollowup, true);
  });
});

describe('the explanation prompt', () => {
  /** Capture the system prompt explainResults sends. */
  async function systemPromptFor(results: any) {
    const { service } = build();
    const original = lmStudio.complete;
    let captured = '';
    (lmStudio as any).complete = async (
      _model: string,
      _user: string,
      system: string,
    ) => {
      captured = system;
      return 'explanation';
    };
    try {
      await quietly(() =>
        service.explainResults('who has the most', 'query { a }', results, 'm', 100000),
      );
    } finally {
      (lmStudio as any).complete = original;
    }
    return captured;
  }

  test('forbids counting repeated values by eye, even on complete data', async () => {
    // The rule used to live only in the query-generation prompt, which is not
    // where the claim gets made. Asked which teacher had the most callbacks
    // sharing a description, the explanation step was handed all 263 rows
    // untruncated and answered 11 for one teacher when another had 144.
    const complete = { callbacks: [{ id: '1', description: 'x' }] };
    const prompt = await systemPromptFor(complete);

    assert.ok(!prompt.includes('THE RESULTS ARE INCOMPLETE'), 'not truncated');
    assert.match(prompt, /CANNOT reliably count/i);
    assert.match(prompt, /even\s+when the results are complete/i);
    assert.match(prompt, /cannot rank these reliably/i);
  });

  test('still warns separately when the data really was cut', async () => {
    const truncated = { _truncated: true, callbacks: [], _callbacks_total: 263 };
    const prompt = await systemPromptFor(truncated);

    assert.match(prompt, /THE RESULTS ARE INCOMPLETE/);
    // Both rules apply: incomplete data and unreliable counting are different
    // problems and the second one does not go away when the first does.
    assert.match(prompt, /CANNOT reliably count/i);
  });
});

describe('sizing results against the context window', () => {
  const { priv } = build();
  const limit = (ctx?: number) => priv.calculateTruncationLimit(ctx);

  test('fits inside the context it is given', () => {
    // The failure this guards: a question was rejected outright with
    // "n_keep: 66341 >= n_ctx: 48128". The budget must leave room for the
    // prompt and the reply, not just for itself.
    const ctx = 47952; // what gpt-oss-120b is actually loaded with
    const chars = limit(ctx);
    // Worst-case tokenisation of dense JSON is about 3 characters per token.
    const worstCaseTokens = chars / 3;
    assert.ok(
      worstCaseTokens + 4700 < ctx,
      `${chars} chars could be ${worstCaseTokens} tokens, which does not fit in ${ctx}`,
    );
  });

  test('does not size against a context the model is not serving', () => {
    // gpt-oss-120b reports a 131072 maximum while loaded at 47952. Sizing
    // against the maximum is what produced the overflow.
    assert.ok(
      limit(47952) < limit(131072),
      'the loaded context must produce a smaller budget than the maximum',
    );
    assert.ok(limit(47952) < 200000);
  });

  test('asks the loaded context, not the model maximum', async () => {
    // calculateTruncationLimit can only be right if it is handed the right
    // number, and the number is chosen in processQuery. Reverting that choice
    // to max_context_length passes every other test in this file.
    const { service, graphql } = build([{ data: { ok: true } }]);
    const original = lmStudio.getModelsWithLimits;
    const seen: Array<number | undefined> = [];

    (lmStudio as any).getModelsWithLimits = async () => [
      {
        id: 'the-model',
        object: 'model',
        type: 'llm',
        max_context_length: 131072,
        loaded_context_length: 47952,
      },
    ];

    const priv = service as any;
    const realLimit = priv.calculateTruncationLimit.bind(service);
    priv.calculateTruncationLimit = (ctx?: number) => {
      seen.push(ctx);
      return realLimit(ctx);
    };
    service.generateQuery = (async () => ({
      query: 'query { a }',
      reasoning: '',
      needsFollowup: false,
    })) as any;
    service.explainResults = (async () => 'explanation') as any;
    service.evaluateResponse = (async () => ({
      score: 9,
      isComplete: true,
      missingInfo: '',
      suggestedFollowup: '',
    })) as any;

    try {
      await quietly(() => service.processQuery('who gave the most cards', 'the-model'));
    } finally {
      (lmStudio as any).getModelsWithLimits = original;
    }

    assert.ok(graphql.calls.length > 0);
    assert.deepEqual(seen, [47952]);
  });

  test('falls back to a fixed budget when the context is unknown', () => {
    assert.equal(limit(undefined), priv.MAX_RESULT_CHARS);
    assert.equal(limit(0), priv.MAX_RESULT_CHARS);
  });

  test('never returns a budget too small to hold anything', () => {
    assert.ok(limit(1000) >= 1000);
  });
});

describe('the loop', () => {
  /**
   * Drives processQuery with the model steps stubbed out, so what is under test
   * is the budget arithmetic and what gets carried forward - not the model.
   */
  const COMPLETE = { score: 9, isComplete: true, missingInfo: '', suggestedFollowup: '' };
  // Never satisfied, so the loop refines until its budget runs out. That is the
  // only way to see how much of that budget the lookups left behind.
  const NEVER_COMPLETE = {
    score: 2,
    isComplete: false,
    missingInfo: 'more',
    suggestedFollowup: 'try again',
  };

  function harness(
    plan: Array<{ needsFollowup: boolean; query: string }>,
    evaluation: any = COMPLETE,
  ) {
    const { service, graphql } = build(
      plan.map((_, i) => ({ data: { step: i + 1 } })),
    );

    const seen: PriorStep[][] = [];
    let call = 0;
    let explains = 0;
    let evaluates = 0;

    service.generateQuery = (async (
      _q: string,
      _m: string,
      _uid?: string,
      _un?: string,
      priorSteps: PriorStep[] = [],
    ) => {
      // Snapshot what this generation was given, not the array that keeps growing.
      seen.push([...priorSteps]);
      // Past the end of the plan, keep the last entry's shape but make the
      // query distinct. A real refinement that returns the identical query is
      // now stopped on purpose, so a repeating stub would silently cut every
      // budget test short. Tests that want a repeat spell it out in the plan.
      const step = plan[Math.min(call, plan.length - 1)];
      const query =
        call < plan.length ? step.query : `${step.query} # pass ${call}`;
      call++;
      return {
        query,
        reasoning: 'stub',
        needsFollowup: step.needsFollowup,
        followupReason: step.needsFollowup ? 'need a value first' : undefined,
      };
    }) as any;

    service.explainResults = (async () => {
      explains++;
      return 'explanation';
    }) as any;

    service.evaluateResponse = (async () => {
      evaluates++;
      return evaluation;
    }) as any;

    return {
      service,
      graphql,
      seen,
      counts: () => ({ explains, evaluates, generates: call }),
    };
  }

  test('a plain question costs one generate, one explain, one evaluate', async () => {
    const h = harness([{ needsFollowup: false, query: 'query { answer }' }]);
    const result = await quietly(() => h.service.processQuery('who gave the most cards', 'm'));

    assert.deepEqual(h.counts(), { generates: 1, explains: 1, evaluates: 1 });
    assert.equal(result.iterations, 1);
    assert.equal(result.explanation, 'explanation');
  });

  test('a requested lookup skips explain and evaluate', async () => {
    // The whole point: explaining a value the model fetched only so it could
    // ask the real question is two model calls spent on nothing.
    const h = harness([
      { needsFollowup: true, query: 'query { theDate }' },
      { needsFollowup: false, query: 'query { answer }' },
    ]);
    await quietly(() => h.service.processQuery('cards since when', 'm'));

    assert.deepEqual(h.counts(), { generates: 2, explains: 1, evaluates: 1 });
  });

  test("the second step sees the first step's results", async () => {
    const h = harness([
      { needsFollowup: true, query: 'query { theDate }' },
      { needsFollowup: false, query: 'query { answer }' },
    ]);
    await quietly(() => h.service.processQuery('cards since when', 'm'));

    assert.equal(h.seen[0].length, 0, 'first generation has no prior steps');
    assert.equal(h.seen[1].length, 1, 'second generation sees the lookup');
    assert.equal(h.seen[1][0].query, 'query { theDate }');
    assert.deepEqual(h.seen[1][0].data, { step: 1 });
  });

  test('the answering step sees every lookup that came before it', async () => {
    const h = harness([
      { needsFollowup: true, query: 'query { one }' },
      { needsFollowup: true, query: 'query { two }' },
      { needsFollowup: false, query: 'query { answer }' },
    ]);
    const result = await quietly(() => h.service.processQuery('cards since when', 'm'));

    assert.deepEqual(h.counts(), { generates: 3, explains: 1, evaluates: 1 });
    assert.equal(result.iterations, 3);
    assert.equal(h.seen[2].length, 2);
    assert.deepEqual(
      h.seen[2].map((s) => s.query),
      ['query { one }', 'query { two }'],
    );
  });

  test('a lookup does not spend the refinement budget', async () => {
    // The counts alone cannot show this: with a satisfied evaluator, spending
    // the budget on lookups or not produces the same three steps. It only shows
    // when refinement actually has work to do, so the evaluator here is never
    // satisfied and the loop runs until something stops it.
    //
    // Two lookups, then all four refinement passes: six steps. If lookups came
    // out of the refinement budget it would stop at four steps and two
    // explanations.
    const h = harness(
      [
        { needsFollowup: true, query: 'query { one }' },
        { needsFollowup: true, query: 'query { two }' },
        { needsFollowup: false, query: 'query { answer }' },
      ],
      NEVER_COMPLETE,
    );
    const result = await quietly(() => h.service.processQuery('cards since when', 'm'));

    const { generates, explains } = h.counts();
    assert.equal(generates, 6, 'two lookups plus four refinements');
    assert.equal(explains, 4, 'the full refinement budget survived the lookups');
    assert.equal(result.iterations, 6);
  });

  test('refinement alone still stops at the refinement budget', async () => {
    // The other side of the same boundary: with no lookups, four passes is all
    // an unsatisfiable evaluator gets.
    const h = harness(
      [{ needsFollowup: false, query: 'query { answer }' }],
      NEVER_COMPLETE,
    );
    const result = await quietly(() => h.service.processQuery('who gave the most cards', 'm'));

    assert.equal(h.counts().generates, 4);
    assert.equal(h.counts().explains, 4);
    assert.equal(result.iterations, 4);
  });

  test('a model that only ever asks for lookups is cut off and made to answer', async () => {
    const h = harness([{ needsFollowup: true, query: 'query { again }' }]);
    const result = await quietly(() => h.service.processQuery('cards since when', 'm'));

    // MAX_LOOKUP_HOPS is 2, so: two lookups, then the third is forced to stand
    // as the answer rather than looping forever.
    assert.equal(h.counts().generates, 3);
    assert.equal(h.counts().explains, 1);
    assert.equal(result.iterations, 3);
  });

  test('stops when a refinement repeats a query that already ran', async () => {
    // Seen in production: the evaluator asked for a follow-up, the model
    // returned a byte-identical query, and the identical result was then scored
    // an 8. Re-running it cannot change the answer, so the pass is refused.
    const h = harness(
      [
        { needsFollowup: false, query: 'query { answer }' },
        { needsFollowup: false, query: 'query { answer }' },
      ],
      NEVER_COMPLETE,
    );
    const result = await quietly(() => h.service.processQuery('who gave the most cards', 'm'));

    // Pass 1 runs and explains. Pass 2 generates the same query and stops
    // before executing it, so there is no second explanation.
    assert.equal(h.counts().generates, 2);
    assert.equal(h.counts().explains, 1);
    // Still two steps: the refused pass cost a generate even though nothing ran
    // from it, and the persisted count should say what the answer cost.
    assert.equal(result.iterations, 2);
    assert.equal(result.explanation, 'explanation');
  });

  test('whitespace alone does not make a query look new', async () => {
    const h = harness(
      [
        { needsFollowup: false, query: 'query { answer }' },
        { needsFollowup: false, query: 'query   {\n  answer\n}' },
      ],
      NEVER_COMPLETE,
    );
    await quietly(() => h.service.processQuery('who gave the most cards', 'm'));
    assert.equal(h.counts().explains, 1);
  });

  test('a genuinely different refinement still runs', async () => {
    const h = harness(
      [
        { needsFollowup: false, query: 'query { first }' },
        { needsFollowup: false, query: 'query { second }' },
        { needsFollowup: false, query: 'query { third }' },
        { needsFollowup: false, query: 'query { fourth }' },
      ],
      NEVER_COMPLETE,
    );
    await quietly(() => h.service.processQuery('who gave the most cards', 'm'));
    assert.equal(h.counts().explains, 4, 'distinct refinements are not blocked');
  });

  test('a collection-scoped question starts with the dates already fetched', async () => {
    const h = harness([{ needsFollowup: false, query: 'query { answer }' }]);
    await quietly(() =>
      h.service.processQuery('how many cards since the last collection', 'm'),
    );

    assert.equal(h.seen[0].length, 1, 'the first generation already has the dates');
    assert.match(h.seen[0][0].query, /pbisCollectionDates/);
    assert.ok(h.seen[0][0].note);
  });
});
