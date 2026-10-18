# Deploy

Publish the qualifier to CloudFront.

## Before you start

AWS credentials for an IAM user that can create Lambda, S3, CloudFront, DynamoDB, SQS, IAM roles, and a Secrets Manager secret. The AWS CLI region is `us-east-1`. Terraform 1.10 or newer is installed. `.env` is only for local runs. Do not commit it. The state bucket `challenge-host-terraform-472876920765` already exists in `us-east-1`.

## Steps

1. From the repo root, run `./infra/publish.sh`.
2. Print the site address with `terraform -chdir=infra output -raw site_url`.

## Check it worked

Open that address. The page title is Challenge host, and the qualifier form is on the page. `/_next/static/` returns a stylesheet with status 200.

An attempt on the live site calls Gemini Flash-Lite. The server Lambda reads the key from Secrets Manager. Publish does not write that secret. Change the live key in Secrets Manager.

## If it fails

A function URL 403 means the Lambda is missing the public `lambda:InvokeFunction` permission. Re-run `./infra/publish.sh`.

`terraform -chdir=infra destroy` deletes the CloudFront distribution, Lambdas, site bucket, queue, tag table, and the secret's name. It does not delete the state bucket, and the secret value can remain for the recovery window.
