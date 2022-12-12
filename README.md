# Stale Inviter

Invite reviewers to your pull request after a certain number of days of inactivity have elapsed.

## Options

| Input            | Description                                                                       | Required | Default           |
|------------------|-----------------------------------------------------------------------------------|----------|-------------------|
| token            | Github token to add reviewers to pull requests                                    |          | ${{github.token}} |
| reviewers        | Comma separated list of reviewers                                                 | ✅       |                   |
| days-until-stale | Age in days the pull request must be to be picked up by this action               | ✅       |                   |
| base-branch      | Only run for pull requests onto the given branch                                  |          |                   |
| ignore-updates   | Use the creation age instead of last update age                                   |          | true              |
| ignore-draft     | Ignore pull requests that are marked as draft                                     |          | true              |
| ignore-reviews   | Do not reset the age when a review is submitted                                   |          | false             |
| approval-count   | After this number of approvals, the pull request is never stale (set 0 to ignore) |          | 1                 |
| label            | Label name to use on stale pull requests                                          |          | Stale             |
| comment          | Comment to add to the pull request. Empty string to skip the comment              |          |                   |

## Example

Run every morning at 8:00
```yaml
name: 'All hands on deck'
on:
  schedule:
    - cron: '0 8 * * *'

jobs:
  invite:
    runs-on: ubuntu-latest
    steps:
      - uses: mr-celo/stale-invite@v1
        with:
          reviewers: 'me,myself,irene'
          days-until-stale: 2
          comment: 'This pull request seems a bit stale.. Shall we invite more to the party?'

```
