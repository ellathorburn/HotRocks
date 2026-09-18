const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('drizzle-orm/node-sqlite');

const mockClient = new DatabaseSync(':memory:');
const migrationRoot = path.join(process.cwd(), 'drizzle');
for (const entry of fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter((candidate) => candidate.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))) {
  const migrationFile = path.join(migrationRoot, entry.name, 'migration.sql');
  if (!fs.existsSync(migrationFile)) continue;
  for (const statement of fs.readFileSync(migrationFile, 'utf8').split('--> statement-breakpoint')) {
    if (statement.trim()) mockClient.exec(statement);
  }
}
const mockDatabase = drizzle({ client: mockClient });

jest.mock('@/services/database/client', () => ({ database: mockDatabase }));

const {
  describeTimelineRuleError,
  sessionTimelineDraftService,
} = require('../src/features/sessions/services/session-draft-service');
const appendSessionInterval = sessionTimelineDraftService.addInterval;
const createSessionTimelineDraft = sessionTimelineDraftService.create;
const moveSessionInterval = sessionTimelineDraftService.moveInterval;
const readSessionTimelineDraft = sessionTimelineDraftService.get;
const removeSessionInterval = sessionTimelineDraftService.removeInterval;
const updateSessionInterval = sessionTimelineDraftService.updateInterval;

describe('session timeline draft service', () => {
  afterAll(() => mockClient.close());

  test('owns all timeline mutations behind readable functions', () => {
    const draftId = createSessionTimelineDraft('user-1', {
      intervals: [],
      venueName: null,
      rating: null,
      note: null,
      startedAt: '2026-09-17T12:00:00.000Z',
      elapsedSeconds: 0,
      entryMethod: 'manual',
    });

    appendSessionInterval(draftId, 'user-1', {
      id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900,
    });
    appendSessionInterval(draftId, 'user-1', {
      id: 'rest-1', kind: 'rest', durationSeconds: 300, temperatureCTenths: null,
    });
    appendSessionInterval(draftId, 'user-1', {
      id: 'heat-2', kind: 'heat', durationSeconds: 600, temperatureCTenths: 950,
    });
    updateSessionInterval(draftId, 'user-1', 'rest-1', (interval) => ({
      ...interval,
      durationSeconds: 480,
    }));
    moveSessionInterval(draftId, 'user-1', 'heat-2', 1);
    removeSessionInterval(draftId, 'user-1', 'heat-1');

    expect(readSessionTimelineDraft(draftId, 'user-2')).toBeNull();
    expect(readSessionTimelineDraft(draftId, 'user-1')).toMatchObject({
      schemaVersion: 2,
      intervals: [
        { id: 'heat-2', kind: 'heat', durationSeconds: 600 },
        { id: 'rest-1', kind: 'rest', durationSeconds: 480 },
      ],
    });
  });

  test('rejects invalid break data and invalid reorder positions', () => {
    const draftId = createSessionTimelineDraft('user-1', {
      intervals: [{
        id: 'cold-1', kind: 'cold', durationSeconds: 60, temperatureCTenths: 80,
      }],
      venueName: null,
      rating: null,
      note: null,
      startedAt: '2026-09-17T13:00:00.000Z',
      elapsedSeconds: 60,
      entryMethod: 'timer',
    });

    expect(() => appendSessionInterval(draftId, 'user-1', {
      id: 'rest-bad', kind: 'rest', durationSeconds: 60, temperatureCTenths: 200,
    })).toThrow();
    expect(() => moveSessionInterval(draftId, 'user-1', 'cold-1', 2))
      .toThrow('Session interval position is out of range.');
  });

  test('refuses to leave a break at the start of a session', () => {
    const draftId = createSessionTimelineDraft('user-1', {
      intervals: [],
      venueName: null,
      rating: null,
      note: null,
      startedAt: '2026-09-17T14:00:00.000Z',
      elapsedSeconds: 0,
      entryMethod: 'manual',
    });

    let rejection;
    try {
      appendSessionInterval(draftId, 'user-1', {
        id: 'rest-first', kind: 'rest', durationSeconds: 300, temperatureCTenths: null,
      });
    } catch (error) {
      rejection = error;
    }
    expect(describeTimelineRuleError(rejection))
      .toBe("A session can't start with a break — add it after a sauna or cold plunge.");

    appendSessionInterval(draftId, 'user-1', {
      id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900,
    });
    appendSessionInterval(draftId, 'user-1', {
      id: 'rest-1', kind: 'rest', durationSeconds: 300, temperatureCTenths: null,
    });

    expect(() => removeSessionInterval(draftId, 'user-1', 'heat-1')).toThrow();
    expect(() => moveSessionInterval(draftId, 'user-1', 'rest-1', 0)).toThrow();
    expect(readSessionTimelineDraft(draftId, 'user-1').intervals.map(({ kind }) => kind))
      .toEqual(['heat', 'rest']);
  });
});
