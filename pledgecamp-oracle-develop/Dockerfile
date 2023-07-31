FROM pledgecamp/golang AS builder

ENV PROJECT_PATH $GOPATH/src/github.com/pledgecamp/pledgecamp-oracle
COPY . $PROJECT_PATH/

WORKDIR $PROJECT_PATH
RUN go install
EXPOSE 8081

CMD ["/usr/local/go/bin/pledgecamp-oracle"]
