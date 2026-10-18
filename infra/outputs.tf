output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "bucket_name" {
  value = aws_s3_bucket.site.id
}

output "table_name" {
  value = aws_dynamodb_table.tags.name
}

output "gemini_secret_id" {
  value = aws_secretsmanager_secret.gemini.arn
}
