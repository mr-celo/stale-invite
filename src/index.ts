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
  private readonly label: string;
  private readonly comment: string;

  private static getBaseBranch(branch?: string): string | undefined {
    if (branch && branch.length === 0) {
      return branch;
    } else {
      return undefined;
    }
  }


  constructor() {
    this.client = github.getOctokit(core.getInput('token'));
    this.reviewers = core.getInput('reviewers').split(',').map(u => u.trim()).filter(u => u.length > 0);
    this.daysUntilTrigger = +core.getInput('days-until-stale') * 24 * 60 * 60 * 1000;
    this.baseBranch = Action.getBaseBranch(core.getInput('base-branch'));
    this.ignoreUpdates = core.getInput('ignore-updates') === 'true';
    this.ignoreDraft = core.getInput('ignore-draft') === 'true';
    this.label = core.getInput('label');
    this.comment = core.getInput('comment');

    if (this.reviewers.length === 0) {
      throw new Error('No reviewers specified');
    }

    if (this.label.length === 0) {
      throw new Error('Label name cannot be empty');
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
        if (pr.labels.find(l => l.name === this.label)) {
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

      const reviewers = this.reviewers.filter(r => !pr.user || r.toLowerCase() !== pr.user.login.toLowerCase());
      if (reviewers.length > 0) {
        try {
          core.info(`- Adding reviewers: ${reviewers}`);
          await this.client.rest.pulls.requestReviewers({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pr.number,
            reviewers: reviewers,
          });
          core.info(`- Adding label: ${this.label}`);
          await this.client.rest.issues.addLabels({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: pr.number,
            labels: [this.label],
          });
          if (this.comment.length > 0) {
            core.info(`- Adding comment: ${this.comment}`);
            await this.client.rest.issues.createComment({
              owner: github.context.repo.owner,
              repo: github.context.repo.repo,
              issue_number: pr.number,
              body: this.comment,
            });
          }
        } catch (error) {
          core.error(`Processing PR error: ${error}`);
        }
      } else {
        throw new Error('There were no reviewers to be added (authors may not be invited)');
      }
    }
  }
}

async function run() {
  return new Action().run();
}

run().catch(error => core.setFailed(error))
