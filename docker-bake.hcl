variable "IMAGE" {
  default = "harbor.10layer.com/docmost/docmost"
}

variable "TAG" {
  default = "dev"
}

group "default" {
  targets = ["docmost"]
}

target "docmost" {
  context    = "."
  dockerfile = "Dockerfile"

  platforms = [
    "linux/amd64",
    "linux/arm64",
  ]

  tags = [
    "${IMAGE}:${TAG}",
    "${IMAGE}:latest",
  ]

  output = ["type=registry"]
}

