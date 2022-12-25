import * as core from '@actions/core';
import * as github from '@actions/github';
import { eachWeekendOfInterval, intervalToDuration } from 'date-fns';
import { GitHub } from '@actions/github/lib/utils';

// Returns true if it should be filtered out
export class Filter {
  static onLabel(pr: { labels: { name: string }[] }, label: string): boolean {
    return pr.labels.find(l => l.name === label) !== undefined;
  }

  static onDraft(pr: { draft?: boolean }, ignoreDraft: boolean): boolean {
    if (!ignoreDraft) {
      return false;
    }
    return pr.draft ? pr.draft : false;
  }

  static onDate(
    pr: { created_at: string, updated_at: string },
    useCreation: boolean,
    ignoreWeekends: boolean,
    now: Date,
    threshold: number
  ): boolean {
    const date = new Date(useCreation ? pr.created_at : pr.updated_at);
    return this.getDurationInDays(date, now, ignoreWeekends) >= threshold;
  }

  static onApproval(reviews: { state: string }[], threshold: number): boolean {
    if (threshold < 1) {
      return false;
    }
    return reviews.filter(r => r.state === 'APPROVED').length >= threshold;
  }

  static onReviewDate(
    reviews: { submitted_at?: string }[],
    ignoreReviews: boolean,
    ignoreWeekends: boolean,
    now: Date,
    threshold: number
  ): boolean {
    if (ignoreReviews) {
      return false;
    }
    const last_review = reviews.reduce((acc, curr) => {
      if (curr.submitted_at) {
        const date = new Date(curr.submitted_at);
        return date > acc ? date : acc;
      } else {
        return acc;
      }
    }, new Date(0));

    return this.getDurationInDays(last_review, now, ignoreWeekends) < threshold;
  }

  static getDurationInDays(start: Date, end: Date, ignoreWeekends: boolean) {
    const interval = {
      start: start,
      end: end,
    };
    const duration = intervalToDuration(interval);
    const weekends = ignoreWeekends ? eachWeekendOfInterval(interval).length : 0;
    return duration.days ? (duration.days - weekends) : 0;
  }
}

class Action {
  private readonly client: InstanceType<typeof GitHub>;
  private readonly reviewers: string[];
  private readonly daysUntilTrigger: number;
  private readonly baseBranch: string | undefined;
  private readonly ignoreUpdates: boolean;
  private readonly ignoreDraft: boolean;
  private readonly ignoreReviews: boolean;
  private readonly ignoreWeekends: boolean;
  private readonly approvalCount: number;
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
    this.daysUntilTrigger = +core.getInput('days-until-stale');
    this.baseBranch = Action.getBaseBranch(core.getInput('base-branch'));
    this.ignoreUpdates = core.getInput('ignore-updates') === 'true';
    this.ignoreDraft = core.getInput('ignore-draft') === 'true';
    this.ignoreReviews = core.getInput('ignore-reviews') === 'true';
    this.ignoreWeekends = core.getInput('ignore-weekends') === 'true';
    this.approvalCount = +core.getInput('approval-count');
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
      const now = new Date();
      return r.data.filter(pr => {
        // Filter already tagged
        if (Filter.onLabel(pr, this.label)) {
          return false;
        }

        // Possibly filter drafts
        if (Filter.onDraft(pr, this.ignoreDraft)) {
          return false;
        }

        // Filter on age
        return Filter.onDate(pr, this.ignoreUpdates, this.ignoreWeekends, now, this.daysUntilTrigger);
      });
    });
  }


  async run() {
    const prs = await this.fetchPullRequests();
    const now = new Date();

    for (const pr of prs) {
      if (!this.ignoreReviews || this.approvalCount > 0) {
        const reviews = await this.client.rest.pulls.listReviews({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          pull_number: pr.number,
        }).then(r => r.data);

        if (Filter.onApproval(reviews, this.approvalCount)) {
          continue;
        }

        if (Filter.onReviewDate(reviews, this.ignoreReviews, this.ignoreWeekends, now, this.daysUntilTrigger)) {
          continue;
        }
      }

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
