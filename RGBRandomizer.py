# Title: RGB Randomizer Microservice
# Class: CS 361 - Software Engineering I
# Author: Christopher Felt
# Description: Microservice that uses ZeroMQ to communicate with a client.
# The microservice:
# 1. Waits for a json request from the client.
# 2. When a json request is received, runs a randomizer function on the RGB values it contains.
# 3. Returns the randomized RGB values as a json to the client.

import time
import zmq
import random

# ZeroMQ socket
context = zmq.Context()
socket = context.socket(zmq.REP)
socket.bind("tcp://*:7077")


def randomize(request):
    """
    Randomizes the RGB values of a list of embroidery layers.
    :param request: A list of dictionaries with RGB key value pairs
    :return: A list of dictionaries with new, randomized RGB key value pairs
    """
    # create dictionary to track repeat colors
    repeat = {}

    # create set to track unique colors in request
    req_unique = set()

    # create set to track unique colors in response
    res_unique = set()

    # prepare list for response
    response = []

    # iterate through RGB list
    for i in range(len(request)):

        # save current RGB combination as a tuple
        rgb = request[i]["r"], request[i]["g"], request[i]["b"]

        # check if current RGB combination in req_unique set
        if rgb not in req_unique:

            # add to req_unique
            req_unique.add(rgb)

            # create randomized RGB tuple
            rand_rgb = rgb

            # generate new RGB combinations until rand_rgb != rgb AND rand_rgb is not
            # in the list of unique colors in the response
            while rand_rgb == rgb or rand_rgb in res_unique:
                rand_rgb = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))

            # add unique rand_rgb RGB value into res_unique
            res_unique.add(rand_rgb)

            # add RGB value to response list
            response.append({"r": rand_rgb[0], "g": rand_rgb[1], "b": rand_rgb[2]})

            # add RGB value to repeat dictionary
            repeat[rgb] = rand_rgb

        # if RGB value is a duplicate in the original list, new value is also a duplicate
        else:
            # save the response value that was already generated
            res_duplicate = repeat[rgb]

            # add duplicate RGB value to response list
            response.append({"r": res_duplicate[0], "g": res_duplicate[1], "b": res_duplicate[2]})

    # return response list
    return response


if __name__ == '__main__':

    # wait for request...
    while True:
        # check for request from client
        request = socket.recv_json()

        print("\nReceived request:  \n%s " % request)

        # reject message if format is unexpected
        if type(request) is not dict:
            print("Invalid message format. Waiting for next message.")
            continue

        # reject message of no status key present
        elif "status" not in request:
            print("Invalid message format. Waiting for next message.")
            continue

        # check status
        status = request["status"]

        # randomize data if status is run
        if status == "run":
            print("\nReceived request from client, generating randomized RGB values...")

            data = request["data"]

            res_rand = randomize(data)

            response = request

            response["status"] = "done"
            response["data"] = res_rand

            print("\nSuccess! Waiting to send response JSON...")

            # wait... (used for testing)
            # time.sleep(1)

            # respond to client
            socket.send_json(response)

            print("\nResponse sent to client!")

        # if status is not run, wait for next message
        else:
            print("Invalid status. Waiting for next message.")
