resource "aws_dynamodb_table" "attempts" {
  name         = "${var.name}-attempts"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"
  range_key    = "createdAt"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "ip"
    type = "S"
  }

  global_secondary_index {
    name            = "by-ip"
    hash_key        = "ip"
    range_key       = "createdAt"
    projection_type = "ALL"
  }
}

resource "aws_iam_role" "grade" {
  name_prefix = "${var.name}-grade-"

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

resource "aws_iam_role_policy_attachment" "grade_logs" {
  role       = aws_iam_role.grade.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "grade" {
  name = "${var.name}-grade"
  role = aws_iam_role.grade.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.gemini.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Query"]
        Resource = aws_dynamodb_table.attempts.arn
      }
    ]
  })
}

resource "aws_lambda_function" "grade" {
  function_name    = "${var.name}-grade"
  role             = aws_iam_role.grade.arn
  filename         = "${path.module}/.build/grade.zip"
  source_code_hash = filebase64sha256("${path.module}/.build/grade.zip")
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  memory_size      = 256
  timeout          = 60

  environment {
    variables = {
      GEMINI_SECRET_ID = aws_secretsmanager_secret.gemini.arn
      ATTEMPTS_TABLE   = aws_dynamodb_table.attempts.name
    }
  }
}

resource "aws_cloudwatch_log_group" "attempts" {
  name              = "/aws/vendedlogs/states/${var.name}-attempt"
  retention_in_days = 30
}

resource "aws_iam_role" "attempt" {
  name_prefix = "${var.name}-attempt-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = { Service = "states.amazonaws.com" }
      }
    ]
  })
}

resource "aws_iam_role_policy" "attempt" {
  name = "${var.name}-attempt"
  role = aws_iam_role.attempt.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
        Resource = aws_dynamodb_table.attempts.arn
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.grade.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups",
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_sfn_state_machine" "attempt" {
  name     = "${var.name}-attempt"
  type     = "EXPRESS"
  role_arn = aws_iam_role.attempt.arn

  logging_configuration {
    log_destination        = "${aws_cloudwatch_log_group.attempts.arn}:*"
    include_execution_data = true
    level                  = "ALL"
  }

  definition = jsonencode({
    Comment = "Record one qualifier attempt"
    StartAt = "Record"
    States = {
      Record = {
        Type     = "Task"
        Resource = "arn:aws:states:::dynamodb:putItem"
        Parameters = {
          TableName = aws_dynamodb_table.attempts.name
          Item = {
            sessionId   = { "S.$" = "$.sessionId" }
            createdAt   = { "S.$" = "$.createdAt" }
            attemptId   = { "S.$" = "$.attemptId" }
            ip          = { "S.$" = "$.ip" }
            instruction = { "S.$" = "$.instruction" }
            targetId    = { "S.$" = "$.targetId" }
            status      = { S = "pending" }
          }
        }
        ResultPath = null
        Next       = "Grade"
      }
      Grade = {
        Type     = "Task"
        Resource = "arn:aws:states:::lambda:invoke"
        Parameters = {
          FunctionName = aws_lambda_function.grade.arn
          Payload = {
            "instruction.$" = "$.instruction"
            "sessionId.$"   = "$.sessionId"
            "targetId.$"    = "$.targetId"
            "groups.$"      = "$.groups"
          }
        }
        ResultSelector = {
          "reply.$"  = "$.Payload.reply"
          "passed.$" = "$.Payload.passed"
        }
        ResultPath = "$.grade"
        Next       = "Save"
      }
      Save = {
        Type     = "Task"
        Resource = "arn:aws:states:::dynamodb:updateItem"
        Parameters = {
          TableName = aws_dynamodb_table.attempts.name
          Key = {
            sessionId = { "S.$" = "$.sessionId" }
            createdAt = { "S.$" = "$.createdAt" }
          }
          UpdateExpression = "SET reply = :reply, passed = :passed, #status = :status, gates = :gates, stars = :stars"
          ExpressionAttributeNames = {
            "#status" = "status"
          }
          ExpressionAttributeValues = {
            ":reply"  = { "S.$" = "$.grade.reply" }
            ":passed" = { "BOOL.$" = "$.grade.passed" }
            ":status" = { S = "done" }
            ":gates"  = { "S.$" = "$.grade.gatesJson" }
            ":stars"  = { "N.$" = "$.grade.starsText" }
          }
        }
        ResultPath = null
        Next       = "Done"
      }
      Done = {
        Type       = "Succeed"
        OutputPath = "$.grade"
      }
    }
  })
}
