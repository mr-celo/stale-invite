import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';

class Action {
  private readonly client: InstanceType<typeof GitHub>;
  private readonly reviewers: string[];
  private readonly daysUntilTrigger: number;
  private readonly baseBranch: string | undefined;
  private readonly ignoreUpdates: boolean;
  private readonly ignoreDraft: boolean;

  static readonly LABEL = 'Stale';

  private static getBaseBranch(branch?: string): string | undefined {
    if (branch && branch.length === 0) {
      return branch;
    } else {
      return undefined;
    }
  }


  constructor() {
    this.client = github.getOctokit(core.getInput('token'));
    this.reviewers = core.getInput('reviwers').split(',');
    this.daysUntilTrigger = +core.getInput('days-until-stale') * 24 * 60 * 60 * 1000;
    this.baseBranch = Action.getBaseBranch(core.getInput('base-branch'));
    this.ignoreUpdates = core.getInput('ignore-updates') === 'true';
    this.ignoreDraft = core.getInput('ignore-draft') === 'true';

    if (this.reviewers.length === 0) {
      throw 'No reviewers specified';
    }
  }

  private async fetchPullRequests() {
    return this.client.rest.pulls.list({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      state: 'open',
      base: this.baseBranch,
      sort: this.ignoreUpdates ? 'created' : 'updated',
      direction: 'desc',
    }).then(r => {
      const now = new Date().getTime();
      return r.data.filter(pr => {
        // Filter already tagged
        if (pr.labels.find(l => l.name === Action.LABEL)) {
          return false;
        }

        // Possibly filter drafts
        if (this.ignoreDraft && pr.draft) {
          return false;
        }

        // Filter on age
        const date = new Date(this.ignoreUpdates ? pr.created_at : pr.updated_at).getTime();
        return now - date > this.daysUntilTrigger;
      });
    });
  }


  async run() {
    const prs = await this.fetchPullRequests();

    for (const pr of prs) {
      const author = pr.user ? ` by ${pr.user.login}` : '';
      core.info(`Stale PR found: ${pr.title} [#${pr.number}]${author}`);

      try {
        await this.client.rest.pulls.requestReviewers({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: pr.number,
          reviewers: this.reviewers,
        });
        await this.client.rest.issues.addLabels({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pr.number,
          labels: [Action.LABEL],
        });
        await this.client.rest.issues.createComment({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pr.number,
          body: 'This pull request seems a bit stale.. Shall we invite more to the party?',
        });
      } catch (error) {
        core.error(`Processing PR error: ${error}`);
      }
    }
  }
}

async function run() {
  return new Action().run();
}

run().catch(error => core.error(error))
