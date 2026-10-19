provider "aws" {
  region = var.aws_region
}

locals {
  build_id = trimspace(file("${path.module}/../.open-next/assets/BUILD_ID"))
}

resource "aws_secretsmanager_secret" "gemini" {
  name = "${var.name}/gemini-api-key"
}

resource "aws_s3_bucket" "site" {
  bucket_prefix = "${var.name}-site-"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tags" {
  name         = "${var.name}-tags"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "tag"
  range_key    = "path"

  attribute {
    name = "tag"
    type = "S"
  }

  attribute {
    name = "path"
    type = "S"
  }

  attribute {
    name = "revalidatedAt"
    type = "N"
  }

  global_secondary_index {
    name            = "revalidate"
    hash_key        = "path"
    range_key       = "revalidatedAt"
    projection_type = "ALL"
  }
}

resource "aws_sqs_queue" "revalidation" {
  name                        = "${var.name}-revalidation.fifo"
  fifo_queue                  = true
  content_based_deduplication = false
  visibility_timeout_seconds  = 60
}

resource "aws_iam_role" "server" {
  name_prefix = "${var.name}-server-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "server_logs" {
  role       = aws_iam_role.server.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "server" {
  name = "${var.name}-server"
  role = aws_iam_role.server.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.site.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.site.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.revalidation.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:BatchWriteItem",
          "dynamodb:DeleteItem",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
        ]
        Resource = [
          aws_dynamodb_table.tags.arn,
          "${aws_dynamodb_table.tags.arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.gemini.arn
      },
      {
        Effect   = "Allow"
        Action   = ["states:StartSyncExecution"]
        Resource = aws_sfn_state_machine.attempt.arn
      }
    ]
  })
}

resource "aws_lambda_function" "server" {
  function_name    = var.name
  role             = aws_iam_role.server.arn
  filename         = "${path.module}/.build/server.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/server.zip")
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  memory_size      = 1024
  timeout          = 60

  environment {
    variables = {
      CACHE_BUCKET_NAME         = aws_s3_bucket.site.id
      CACHE_BUCKET_KEY_PREFIX   = "_cache"
      CACHE_BUCKET_REGION       = var.aws_region
      CACHE_DYNAMO_TABLE        = aws_dynamodb_table.tags.name
      REVALIDATION_QUEUE_URL    = aws_sqs_queue.revalidation.url
      REVALIDATION_QUEUE_REGION = var.aws_region
      OPEN_NEXT_BUILD_ID        = local.build_id
      GEMINI_SECRET_ID          = aws_secretsmanager_secret.gemini.arn
      ATTEMPT_STATE_MACHINE_ARN = aws_sfn_state_machine.attempt.arn
    }
  }
}

resource "aws_lambda_function_url" "server" {
  function_name      = aws_lambda_function.server.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"
}

# Function URLs created after October 2025 also need InvokeFunction.
resource "aws_lambda_permission" "server_public" {
  statement_id             = "FunctionURLInvokeAllowPublicAccess"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.server.function_name
  principal                = "*"
  invoked_via_function_url = true
}

resource "aws_iam_role" "image" {
  name_prefix = "${var.name}-image-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "image_logs" {
  role       = aws_iam_role.image.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "image" {
  name = "${var.name}-image"
  role = aws_iam_role.image.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = "${aws_s3_bucket.site.arn}/*"
      }
    ]
  })
}

resource "aws_lambda_function" "image" {
  function_name    = "${var.name}-image"
  role             = aws_iam_role.image.arn
  filename         = "${path.module}/.build/image.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/image.zip")
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  memory_size      = 1536
  timeout          = 30

  environment {
    variables = {
      BUCKET_NAME       = aws_s3_bucket.site.id
      BUCKET_KEY_PREFIX = "_assets"
    }
  }
}

resource "aws_lambda_function_url" "image" {
  function_name      = aws_lambda_function.image.function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"
}

resource "aws_lambda_permission" "image_public" {
  statement_id             = "FunctionURLInvokeAllowPublicAccess"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.image.function_name
  principal                = "*"
  invoked_via_function_url = true
}

resource "aws_iam_role" "revalidation" {
  name_prefix = "${var.name}-revalidation-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "lambda.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "revalidation_logs" {
  role       = aws_iam_role.revalidation.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "revalidation_sqs" {
  role       = aws_iam_role.revalidation.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaSQSQueueExecutionRole"
}

resource "aws_lambda_function" "revalidation" {
  function_name    = "${var.name}-revalidation"
  role             = aws_iam_role.revalidation.arn
  filename         = "${path.module}/.build/revalidate.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/revalidate.zip")
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  memory_size      = 256
  timeout          = 30
}

resource "aws_lambda_event_source_mapping" "revalidation" {
  event_source_arn = aws_sqs_queue.revalidation.arn
  function_name    = aws_lambda_function.revalidation.arn
  batch_size       = 5
}

resource "aws_cloudfront_origin_access_control" "assets" {
  name                              = "${var.name}-assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "host" {
  name    = "${var.name}-host"
  runtime = "cloudfront-js-2.0"
  publish = true
  # The Lambda host is the function URL. Next needs the visitor host.
  code = <<-EOF
    function handler(event) {
      var request = event.request;
      request.headers["x-forwarded-host"] = request.headers.host;
      if (event.viewer && event.viewer.ip) {
        request.headers["x-viewer-ip"] = { value: event.viewer.ip };
        request.headers["cloudfront-viewer-address"] = { value: event.viewer.ip };
      }
      return request;
    }
  EOF
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "all_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "site" {
  enabled         = true
  price_class     = "PriceClass_100"
  comment         = var.name
  is_ipv6_enabled = true

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "assets"
    origin_path              = "/_assets"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets.id
  }

  origin {
    domain_name = trimsuffix(replace(aws_lambda_function_url.server.function_url, "https://", ""), "/")
    origin_id   = "server"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }
  }

  origin {
    domain_name = trimsuffix(replace(aws_lambda_function_url.image.function_url, "https://", ""), "/")
    origin_id   = "image"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 30
    }
  }

  default_cache_behavior {
    target_origin_id         = "server"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
    compress                 = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.host.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/_next/image*"
    target_origin_id         = "image"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
    compress                 = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.host.arn
    }
  }

  ordered_cache_behavior {
    path_pattern             = "/_next/data/*"
    target_origin_id         = "server"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
    compress                 = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.host.arn
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/_next/*"
    target_origin_id       = "assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true
  }

  dynamic "ordered_cache_behavior" {
    for_each = ["BUILD_ID", "favicon.ico", "file.svg", "globe.svg", "next.svg", "vercel.svg", "window.svg"]

    content {
      path_pattern           = "/${ordered_cache_behavior.value}"
      target_origin_id       = "assets"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
      compress               = true
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAssets"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.site.arn}/_assets/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      }
    ]
  })
}
