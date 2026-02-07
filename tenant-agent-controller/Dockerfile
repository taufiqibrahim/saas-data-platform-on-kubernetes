FROM python:3.14-alpine

# Add version as build argument and label
ARG VERSION=dev
LABEL version="${VERSION}" \
      maintainer="taufiq.ibrahim@gmail.com" \
      description="Tenant workspace controller using Kopf"

WORKDIR /app

COPY requirements.txt /app
RUN pip install -r requirements.txt

RUN apk add --no-cache bash curl && \
    curl -fsSL https://kubevela.io/script/install.sh | bash

COPY ./src /app/src

CMD ["kopf", "run", "/app/src/main.py", "-n", "vela-system", "-n", "saas*"]
