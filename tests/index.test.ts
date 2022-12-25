import { Filter } from '../src/index';
import { expect, test } from '@jest/globals';

// Label
test('filters on label', () => {
  let pr = {
    labels: [
      {
        name: 'Some',
      },
      {
        name: 'Label',
      },
      {
        name: 'Here',
      },
    ],
  };
  expect(Filter.onLabel(pr, 'Label')).toBe(true);
});

test('does not filter on no labels', () => {
  let pr = {
    labels: [],
  };
  expect(Filter.onLabel(pr, 'Label')).toBe(false);
});

test('does not filter on different labels', () => {
  let pr = {
    labels: [
      {
        name: 'Some',
      },
      {
        name: 'Other',
      },
    ],
  };
  expect(Filter.onLabel(pr, 'Label')).toBe(false);
});

// Draft
test('filters on draft', () => {
  let pr = {
    draft: true
  };
  expect(Filter.onDraft(pr, true)).toBe(true);
});

test('does not filter on draft if should ignore', () => {
  let pr = {
    draft: true,
  };
  expect(Filter.onDraft(pr, false)).toBe(false);
});

test('does not filter on draft if missing', () => {
  let pr = {};
  expect(Filter.onDraft(pr, true)).toBe(false);
});

test('does not filter on draft if false', () => {
  let pr = {
    draft: false
  };
  expect(Filter.onDraft(pr, true)).toBe(false);
});

// Date
test('filters on creation date', () => {
  let pr = {
    created_at: new Date(0).toISOString(),
    updated_at: new Date().toISOString(),
  };
  expect(Filter.onDate(pr, true, false, new Date(), 1)).toBe(true);
});

test('filters on update date', () => {
  let pr = {
    created_at: new Date().toISOString(),
    updated_at: new Date(0).toISOString(),
  };
  expect(Filter.onDate(pr, false, false, new Date(), 1)).toBe(true);
});

test('does not filter on date if young', () => {
  let pr = {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  expect(Filter.onDate(pr, true, false, new Date(), 1)).toBe(false);
  expect(Filter.onDate(pr, false, false, new Date(), 1)).toBe(false);
});

// Approval
test('filters on approval', () => {
  let reviews = [
    {
      state: 'CHANGES_REQUESTED',
    },
    {
      state: 'APPROVED',
    },
    {
      state: 'CHANGES_REQUESTED',
    },
    {
      state: 'APPROVED',
    },
    {
      state: 'CHANGES_REQUESTED',
    },
  ];
  expect(Filter.onApproval(reviews, 1)).toBe(true);
  expect(Filter.onApproval(reviews, 2)).toBe(true);
});

test('does not filter on approval if should ignore', () => {
  let reviews = [
    {
      state: 'CHANGES_REQUESTED',
    },
    {
      state: 'APPROVED',
    },
    {
      state: 'CHANGES_REQUESTED',
    },
    {
      state: 'APPROVED',
    },
    {
      state: 'CHANGES_REQUESTED',
    },
  ];
  expect(Filter.onApproval(reviews, 0)).toBe(false);
  expect(Filter.onApproval(reviews, 0.1)).toBe(false);
  expect(Filter.onApproval(reviews, -1)).toBe(false);
});

test('does not filter on approval if not enough', () => {
  let reviews = [
    {
      state: 'CHANGES_REQUESTED',
    },
    {
      state: 'APPROVED',
    },
    {
      state: 'CHANGES_REQUESTED',
    },
    {
      state: 'APPROVED',
    },
    {
      state: 'CHANGES_REQUESTED',
    },
  ];
  expect(Filter.onApproval(reviews, 10)).toBe(false);
  expect(Filter.onApproval([], 10)).toBe(false);
});

// Review Date
test('filters on review date if at least one recent', () => {
  let reviews = [
    {
      submitted_at: new Date(0).toISOString(),
    },
    {
      submitted_at: new Date().toISOString(),
    },
    {
      submitted_at: new Date(0).toISOString(),
    },
  ];
  expect(Filter.onReviewDate(reviews, false, false, new Date(), 1)).toBe(true);
});

test('does not filter on review date if should ignore', () => {
  let reviews = [
    {
      submitted_at: new Date(0).toISOString(),
    },
    {
      submitted_at: new Date().toISOString(),
    },
    {
      submitted_at: new Date(0).toISOString(),
    },
  ];
  expect(Filter.onReviewDate(reviews, true, false, new Date(), 1)).toBe(false);
});

test('does not filter on review date if all are old', () => {
  let reviews = [
    {
      submitted_at: new Date(0).toISOString(),
    },
    {
      submitted_at: new Date(0).toISOString(),
    },
  ];
  expect(Filter.onReviewDate(reviews, false, false, new Date(), 1)).toBe(false);
});

test('does not filter on review date if date missing', () => {
  let reviews = [
    {},
  ];
  expect(Filter.onReviewDate(reviews, false, false, new Date(), 1)).toBe(false);
  expect(Filter.onReviewDate([], false, false, new Date(), 1)).toBe(false);
});

// Weekends
test('weekends should count', () => {
  expect(Filter.getDurationInDays(new Date('2023-01-01T00:00:00Z'), new Date('2023-01-14T00:00:00Z'), false)).toBe(13);
});

test('weekends should not count', () => {
  expect(Filter.getDurationInDays(new Date('2023-01-01T00:00:00Z'), new Date('2023-01-14T00:00:00Z'), true)).toBe(9);
});
