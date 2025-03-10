export function parseGitHubUrl(url: string) {
  try {
    // Handle both HTTPS and SSH URLs
    let owner, repo;

    if (url.startsWith('git@github.com:')) {
      // SSH format: git@github.com:owner/repo.git
      [owner, repo] = url.replace('git@github.com:', '').replace('.git', '').split('/');
    } else {
      // HTTPS format: https://github.com/owner/repo
      const urlObj = new URL(url);
      [owner, repo] = urlObj.pathname.slice(1).replace('.git', '').split('/');
    }

    if (!owner || !repo) {
      throw new Error('Invalid GitHub URL format');
    }

    return { owner, repo };
  } catch (error) {
    throw new Error('Invalid GitHub URL');
  }
}