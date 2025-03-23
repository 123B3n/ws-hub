# Documentation Files for Wiki

This directory contains all the documentation files that are automatically synchronized to the GitHub Wiki. The synchronization is handled by a GitHub Action that runs when changes are pushed to this directory.

## How to Update Documentation

1. Make changes to the relevant markdown files in this directory
2. Commit and push your changes to the main branch
3. The GitHub Action will automatically sync the changes to the Wiki

## File to Wiki Page Mapping

| File in `/docs` | Wiki Page |
|-----------------|-----------|
| `iis-guide.md` | IIS Integration Guide |
| `cloudflare-guide.md` | Cloudflare Guide |
| `configuration-guide.md` | Configuration Guide |
| `client-integration.md` | Client Integration Guide |
| `api-documentation.md` | API Documentation |
| `troubleshooting.md` | Troubleshooting Guide |
| `client-data.md` | Client Data Structure |

## Important Notes

- The Wiki is read-only for most contributors. All changes should be made through this repository.
- Images used in documentation should be placed in the `/docs/assets` directory.
- Reference images using relative paths like `assets/image-name.png`.

## Adding New Documentation Pages

To add a new documentation page:

1. Create a new markdown file in this directory
2. Add the file to the `wiki-sync.yml` workflow
3. Update the `Home.md` file in the workflow to include a link to your new page
4. Submit a PR with your changes
