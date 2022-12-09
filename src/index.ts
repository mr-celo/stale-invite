import * as core from '@actions/core';
import * as github from '@actions/github';
import { WebhookPayload } from '@actions/github/lib/interfaces';

function getUser(): string {
  const pr = github.context.payload.pull_request;
  if (pr && pr.user && pr.user.login) {
    return pr.user.login;
  }
  throw 'Author for the PR could not be extracted';
}

function getComment(payload: WebhookPayload, caseInsensitive: boolean): string {
  if (!payload.comment || !payload.comment.body) {
    return '';
  }
  const comment = payload.comment.body;
  if (caseInsensitive) {
    return comment.toLowerCase();
  } else {
    return comment;
  }
}

async function action() {
  const context = github.context;
  if (context.eventName !== 'pull_request_comment') {
    throw 'Can only use this action on pull_request_comment';
  }

  const payload = context.payload
  if (payload.action !== 'created' && payload.action !== 'edited') {
    // TODO: Report that nothing was done
    return;
  }

  // Params
  const client = github.getOctokit(core.getInput('token'));
  const reviewers = core.getInput('reviewers').split(',').filter(u => u !== user);
  const caseInsensitive = core.getInput('case-insensitive') === 'true';
  const trigger = caseInsensitive ? core.getInput('trigger').toLowerCase() : core.getInput('trigger');

  const comment = getComment(payload, caseInsensitive);

  // Pull request
  const repo = context.repo;
  const user = getUser();
}

action().catch(error => core.setFailed(error.message))
