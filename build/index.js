"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
class Action {
    static getBaseBranch(branch) {
        if (branch && branch.length === 0) {
            return branch;
        }
        else {
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
    fetchPullRequests() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const prs = yield this.fetchPullRequests();
            for (const pr of prs) {
                const author = pr.user ? ` by ${pr.user.login}` : '';
                core.info(`Stale PR found: ${pr.title} [#${pr.number}]${author}`);
                try {
                    yield this.client.rest.pulls.requestReviewers({
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        pull_number: pr.number,
                        reviewers: this.reviewers,
                    });
                    yield this.client.rest.issues.addLabels({
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        issue_number: pr.number,
                        labels: [Action.LABEL],
                    });
                    yield this.client.rest.issues.createComment({
                        owner: github.context.repo.owner,
                        repo: github.context.repo.repo,
                        issue_number: pr.number,
                        body: 'This pull request seems a bit stale.. Shall we invite more to the party?',
                    });
                }
                catch (error) {
                    core.error(`Processing PR error: ${error}`);
                }
            }
        });
    }
}
Action.LABEL = 'Stale';
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Action().run();
    });
}
run().catch(error => core.error(error));
