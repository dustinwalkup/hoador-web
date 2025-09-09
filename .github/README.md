# GitHub Actions Workflows

This directory contains all GitHub Actions workflows for the Hoador Web project.

## Workflows Overview

### 1. CI/CD Pipeline (`.github/workflows/ci.yml`)

**Triggers:** Push to `main` or `develop` branches, Pull Requests

**Jobs:**

- **Quality Checks**: Type checking, linting, formatting
- **Tests**: Run test suite with coverage reporting
- **Build**: Build the application (only if quality and tests pass)
- **Security**: Security audit and vulnerability scanning

### 2. Pull Request Checks (`.github/workflows/pr-checks.yml`)

**Triggers:** Pull Requests to `main` or `develop` branches

**Features:**

- PR size validation
- Test coverage reporting with PR comments
- Breaking changes detection
- Performance checks

### 3. Deployment (`.github/workflows/deploy.yml`)

**Triggers:** Push to `main` branch, Manual trigger

**Deployment Options:**

- Vercel deployment (recommended for Next.js)
- Custom server deployment
- Deployment notifications

### 4. Database Operations (`.github/workflows/database.yml`)

**Triggers:** Changes to database files, Manual trigger

**Operations:**

- Generate migrations
- Run migrations
- Push schema changes
- Seed database
- Validate schema

### 5. Nightly Maintenance (`.github/workflows/nightly.yml`)

**Triggers:** Daily at 2 AM UTC, Manual trigger

**Tasks:**

- Dependency updates check
- Comprehensive testing
- Security auditing
- Performance monitoring
- Report generation

## Required Secrets

To use these workflows, you need to set up the following secrets in your repository:

### Repository Secrets (Settings → Secrets and variables → Actions)

#### For CI/CD:

- `NEXT_PUBLIC_APP_URL`: Your production app URL

#### For Deployment (Vercel):

- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

#### For Database Operations:

- `DATABASE_URL`: Production database URL
- `DATABASE_URL_DEV`: Development database URL

#### For Custom Server Deployment:

- `SERVER_HOST`: Your server hostname
- `SERVER_USERNAME`: SSH username
- `SERVER_SSH_KEY`: SSH private key

## Environment Setup

### Required Environment Variables

Create these environment variables in your deployment platform:

```bash
# Production
NEXT_PUBLIC_APP_URL=https://your-domain.com
DATABASE_URL=your-production-database-url

# Development
DATABASE_URL_DEV=your-development-database-url
```

## Workflow Features

### Code Quality

- ✅ TypeScript type checking
- ✅ ESLint code linting
- ✅ Prettier formatting checks
- ✅ Automated dependency updates (Dependabot)

### Testing

- ✅ Unit tests with Vitest
- ✅ Test coverage reporting
- ✅ Coverage comments on PRs
- ✅ Parallel test execution

### Security

- ✅ Dependency vulnerability scanning
- ✅ Security audit with `bun audit`
- ✅ Trivy vulnerability scanner
- ✅ SARIF security reports

### Performance

- ✅ Build time monitoring
- ✅ Bundle size analysis
- ✅ Performance regression detection

### Database

- ✅ Automated migration generation
- ✅ Schema validation
- ✅ Database seeding
- ✅ Migration safety checks

## Usage Examples

### Running Workflows Manually

1. Go to Actions tab in your GitHub repository
2. Select the workflow you want to run
3. Click "Run workflow"
4. Choose the branch and any required inputs

### Database Operations

```bash
# Generate new migration
gh workflow run database.yml -f operation=generate

# Run migrations
gh workflow run database.yml -f operation=migrate

# Seed database
gh workflow run database.yml -f operation=seed
```

### Checking Workflow Status

```bash
# List recent workflow runs
gh run list

# View specific workflow run
gh run view <run-id>

# Download workflow logs
gh run download <run-id>
```

## Troubleshooting

### Common Issues

1. **Build Failures**: Check the build logs for TypeScript errors or missing dependencies
2. **Test Failures**: Review test output and fix failing tests
3. **Deployment Issues**: Verify secrets are correctly set and deployment environment is configured
4. **Database Issues**: Ensure database URLs are correct and accessible

### Debug Mode

To enable debug logging, add this to your workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
  ACTIONS_RUNNER_DEBUG: true
```

### Workflow Permissions

If you encounter permission issues, add this to your workflow:

```yaml
permissions:
  contents: read
  pull-requests: write
  security-events: write
```

## Best Practices

1. **Keep workflows fast**: Use parallel jobs where possible
2. **Cache dependencies**: Use `bun install --frozen-lockfile` for consistent installs
3. **Fail fast**: Use `needs` to prevent unnecessary job execution
4. **Security first**: Never commit secrets, use GitHub Secrets
5. **Monitor costs**: Be aware of GitHub Actions usage limits

## Customization

### Adding New Jobs

```yaml
jobs:
  my-new-job:
    name: My New Job
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      # Add your steps here
```

### Adding New Triggers

```yaml
on:
  push:
    branches: [main, develop]
    paths: ["src/**"] # Only run when src files change
  schedule:
    - cron: "0 0 * * 1" # Weekly on Monday
```

### Using Different Runners

```yaml
jobs:
  windows-test:
    runs-on: windows-latest
  macos-test:
    runs-on: macos-latest
  self-hosted:
    runs-on: self-hosted
```

## Monitoring and Alerts

### Workflow Notifications

Set up notifications for:

- Workflow failures
- Security vulnerabilities
- Dependency updates
- Deployment status

### Metrics to Track

- Build success rate
- Test coverage trends
- Deployment frequency
- Security scan results
- Performance metrics

## Support

For issues with these workflows:

1. Check the workflow logs in the Actions tab
2. Review this documentation
3. Check GitHub Actions documentation
4. Create an issue in this repository

## Contributing

When modifying workflows:

1. Test changes in a feature branch first
2. Update this documentation
3. Ensure all required secrets are documented
4. Test with different trigger conditions
