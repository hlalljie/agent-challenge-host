# Deploy

Publish the qualifier to CloudFront.

## Before you start

AWS credentials for an IAM user that can create Lambda, S3, CloudFront, DynamoDB, SQS, IAM roles, and a Secrets Manager secret. The AWS CLI region is `us-east-1`. Terraform is installed. `.env` is only for local runs. Do not commit it.

## Steps

1. From the repo root, run `./infra/publish.sh`.
2. Print the site address with `terraform -chdir=infra output -raw site_url`.

## Check it worked

Open that address. The page title is Challenge host, and the qualifier form is on the page. `/_next/static/` returns a stylesheet with status 200.

An attempt on the live site calls Gemini Flash-Lite with the key in Secrets Manager. The first publish copies `GEMINI_API_KEY` from `.env` into that secret. Later publishes leave the secret as it is when `.env` has no key. Change the live key in Secrets Manager, not in the Lambda environment.

## If it fails

A function URL 403 means the Lambda is missing the public `lambda:InvokeFunction` permission. Re-run `./infra/publish.sh`.

To remove the site, run `terraform -chdir=infra destroy`. That deletes the CloudFront distribution, Lambdas, bucket, queue, and tag table.
