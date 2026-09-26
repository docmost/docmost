resource "aws_security_group" "web" {
  name        = "docmost-web-sg"
  description = "Allow web traffic to the Docmost server"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name    = "docmost-web-sg"
    Project = "docmost"
  }
}

resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.web.id
  description       = "Allow HTTP from the internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.web.id
  description       = "Allow HTTPS from the internet"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  description       = "Allow the server to access external services"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}