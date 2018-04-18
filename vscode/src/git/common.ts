const uncommittedRegex = /^[0]{40}(\^[0-9]*?)??:??$/;

export function isUncommitted(sha: string) {
    return uncommittedRegex.test(sha);
}
