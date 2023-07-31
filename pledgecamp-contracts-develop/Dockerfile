FROM pledgecamp/nodejs as builder
# Use layered build because we are injecting a private key and need way to safely remove
ARG SSH_PRIVATE_KEY
RUN \
  mkdir /root/.ssh/ && \
  echo "${SSH_PRIVATE_KEY}" > /root/.ssh/id_rsa && \
  chmod 600 /root/.ssh/id_rsa && \
  touch /root/.ssh/known_hosts && \
  ssh-keyscan github.com >> /root/.ssh/known_hosts
WORKDIR /src
COPY . /src
COPY .env.dist /src/.env
RUN npm i

FROM pledgecamp/nodejs

EXPOSE 8545
WORKDIR /src
COPY --from=builder /src /src
# Install libusb or Node will complain about missing I/O capability and crash
RUN \
  apt-get update \
  && apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev
CMD ["/src/scripts/npmstarter.sh"]

