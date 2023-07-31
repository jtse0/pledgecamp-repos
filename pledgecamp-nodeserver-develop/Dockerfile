FROM pledgecamp/nodejs as builder
# We use a multi-stage build because, we are putting an SSH key for Github checkout in to
# the Docker image; copying the built app in to a fresh container fixes this

ARG SSH_PRIVATE_KEY
RUN \
  mkdir /root/.ssh/ && \
  echo "${SSH_PRIVATE_KEY}" > /root/.ssh/id_rsa && \
  chmod 600 /root/.ssh/id_rsa && \
  touch /root/.ssh/known_hosts && \
  ssh-keyscan github.com >> /root/.ssh/known_hosts
WORKDIR /src
COPY . /src
RUN npm i
EXPOSE 3010

FROM pledgecamp/nodejs

EXPOSE 3010
WORKDIR /src
COPY --from=builder /src /src
RUN \
  apt-get update && apt-get install -y libusb-1.0-0-dev libudev-dev && apt-get install sqlite3 && npm i \
  && chmod +x /src/scripts/npmstarter.sh
CMD ["/src/scripts/npmstarter.sh"]