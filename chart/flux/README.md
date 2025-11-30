# Flux CD Setup for EDK

This directory contains Flux CD manifests for automated deployment of EDK when new images are pushed to `ghcr.io/eve-kill/edk:latest`.

## Components

1. **ImageRepository** (`image-repository.yaml`): Watches the `ghcr.io/eve-kill/edk` registry every minute
2. **ImagePolicy** (`image-policy.yaml`): Defines policy to track the `latest` tag
3. **ImageUpdateAutomation** (`image-update-automation.yaml`): Automatically updates `values.yaml` with new image digest and commits to git
4. **GitRepository** (`gitrepository.yaml`): Flux source for the EDK git repository
5. **HelmRelease** (`helmrelease.yaml`): Flux HelmRelease that deploys the chart to `eve-kill` namespace

## Setup Instructions

### 1. Install Flux CLI

```bash
brew install fluxcd/tap/flux
```

### 2. Bootstrap Flux on Your Cluster

```bash
export GITHUB_TOKEN=<your-github-token>
flux bootstrap github \
  --owner=EVE-KILL \
  --repository=edk \
  --branch=main \
  --path=./chart/flux \
  --personal
```

### 3. Create Image Pull Secret (if using private registry)

```bash
kubectl create secret docker-registry ghcr-credentials \
  --namespace=flux-system \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token>
```

### 4. Create GitHub Credentials Secret (for git push)

Flux needs write access to update `values.yaml`:

```bash
kubectl create secret generic github-credentials \
  --namespace=flux-system \
  --from-literal=username=<github-username> \
  --from-literal=password=<github-token>
```

### 5. Create Helm Values Secret

Store your production `values.yaml` in a Kubernetes secret:

```bash
kubectl create secret generic edk-values \
  --namespace=flux-system \
  --from-file=values.yaml=./chart/values.yaml
```

### 6. Apply Flux Manifests

```bash
kubectl apply -f chart/flux/
```

## How It Works

1. **GitHub Actions** builds and pushes new image with tags `latest` and `sha-{SHA}` to `ghcr.io/eve-kill/edk`
2. **ImageRepository** polls `ghcr.io` every minute and detects new `latest` tag
3. **ImagePolicy** validates the new tag matches the filter pattern
4. **ImageUpdateAutomation** updates the `tag:` field in `values.yaml` with the new image digest
5. **ImageUpdateAutomation** commits the change to the `main` branch with message `[ci skip]`
6. **GitRepository** detects the commit and updates the source
7. **HelmRelease** reconciles and runs `helm upgrade` with the new image tag
8. **Deploy Job** runs as a Helm post-upgrade hook (migrations, SDE download, refresh)
9. **Pods** restart with the new image

## Monitoring

Check Flux status:

```bash
# Overall Flux status
flux get all -A

# Image automation status
flux get image repository edk -n flux-system
flux get image policy edk-latest -n flux-system
flux get image update edk -n flux-system

# Helm release status
flux get helmrelease edk -n flux-system

# Watch logs
flux logs --follow --namespace=flux-system
```

Check reconciliation:

```bash
# Force reconciliation
flux reconcile image repository edk -n flux-system
flux reconcile helmrelease edk -n flux-system

# Check events
kubectl get events -n flux-system --sort-by='.lastTimestamp'
```

## Troubleshooting

### Image not updating

1. Check ImageRepository can access registry:

   ```bash
   kubectl describe imagerepository edk -n flux-system
   ```

2. Verify secret exists and is valid:
   ```bash
   kubectl get secret ghcr-credentials -n flux-system
   ```

### Git push failing

1. Check GitHub credentials have write access:

   ```bash
   kubectl describe imageupdateautomation edk -n flux-system
   ```

2. Verify the token has `repo` scope

### HelmRelease not deploying

1. Check HelmRelease status:

   ```bash
   flux get helmrelease edk -n flux-system
   kubectl describe helmrelease edk -n flux-system
   ```

2. Check if values secret exists:
   ```bash
   kubectl get secret edk-values -n flux-system
   ```

## Customization

### Change polling interval

Edit `interval:` in the manifests (default: 1 minute for fast updates)

### Use SHA tags instead of latest

Modify `image-policy.yaml`:

```yaml
spec:
  policy:
    semver:
      range: 'sha-*'
  filterTags:
    pattern: '^sha-[a-f0-9]+$'
    extract: '$0'
```

### Disable auto-commit

Remove the `git:` section from `image-update-automation.yaml` and manually update the image tag

## Security Notes

- The `github-credentials` secret needs write access to your repository
- Consider using a GitHub App or deploy key with limited permissions
- The `[ci skip]` prefix prevents GitHub Actions from triggering on Flux commits
- Image digests are used for immutability (not just tags)
