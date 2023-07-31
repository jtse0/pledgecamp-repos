package utils

import (
	"errors"
	"log"
	"os"

	"github.com/imroc/req"
	"github.com/pledgecamp/pledgecamp-oracle/structs"
)

type RequestHeader = req.Header
type RequestParameters = req.Param
type Response = *req.Resp
type NodeServerModel = structs.NodeServerModel

func PostNodeServer(requestParameters RequestParameters, uri string) (NodeServerModel, error) {

	header := req.Header{
		"Accept":        "application/json",
		"Authorization": "Bearer " + os.Getenv("NODESERVER_AUTH_ACCESS_TOKEN"),
	}

	var fullUrl string
	fullUrl = os.Getenv("NODESERVER_URL") + uri
	log.Printf("Making a request to %s", fullUrl)
	response, err := req.Post(fullUrl, header, requestParameters)
	var NewResponse NodeServerModel
	if err != nil {
		log.Fatal(err)
		return NewResponse, err
	} else if response.Response().StatusCode > 201 {
		err := errors.New("Server response failed")
		log.Fatal(err)
		return NewResponse, err
	}
	response.ToJSON(&NewResponse)
	return NewResponse, nil
}

func GetNodeServer(requestParameters RequestParameters, uri string) (*req.Resp, error) {

	header := req.Header{
		"Accept":        "application/json",
		"Authorization": "Bearer " + os.Getenv("NODESERVER_AUTH_ACCESS_TOKEN"),
	}

	var fullUrl string
	fullUrl = os.Getenv("NODESERVER_URL") + uri
	response, err := req.Get(fullUrl, header, requestParameters)
	if err != nil {
		return response, err
	}
	return response, nil
}

func PostBackend(requestParameters RequestParameters, uri string) (Response, error) {

	//TODO: Enable basic auth
	header := req.Header{
		"Accept":        "application/json",
		"Content-Type":  "application/json",
		"Authorization": "Bearer " + os.Getenv("BACKEND_AUTH_ACCESS_TOKEN"),
	}

	var fullUrl string
	fullUrl = os.Getenv("BACKEND_URL") + uri

	// TODO: Check backend validation of types
	response, err := req.Post(fullUrl, header, requestParameters)
	if err != nil {
		log.Fatal(err)
		return response, err
	} else if response.Response().StatusCode > 201 {
		err := errors.New("Server response failed")
		log.Fatal(err)
		return response, err
	}

	return response, nil
}
