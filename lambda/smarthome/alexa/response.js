/**
 * Copyright (c) 2014-2019 by the respective copyright holders.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 */

/**
 * Amazon Smart Home Skill Response for API V3
 */
const uuid = require('uuid/v4');
const log = require('@lib/log.js');

/**
 * Defines Alexa response class
 */
class AlexaResponse {
  /**
   * Constructor
   * @param {Object}   directive
   * @param {Function} callback
   */
  constructor(directive, callback) {
    this.directive = directive;
    this.callback = callback;
  }

  /**
   * Generates Alexa response
   * @param  {Object} parameters  [context, header, payload]
   * @return {Object}
   */
  generateResponse(parameters = {}) {
    return Object.assign({
    }, parameters.context && {
      // Include context properties if provided
      context: parameters.context
    }, {
      // Include event properties
      event: Object.assign({
        // Add event header
        header: this.generateResponseHeader(parameters.header)
      }, this.directive.endpoint && {
        // Add event endpoint if provided in directive
        endpoint: {
          scope: this.directive.endpoint.scope,
          endpointId: this.directive.endpoint.endpointId
        }
      }, {
        // Add event payload
        payload: parameters.payload || {}
      })
    });
  }

  /**
   * Generates Alexa response header
   * @param  {Object} parameters  [name, namespace]
   * @return {Object}
   */
  generateResponseHeader(parameters = {}) {
    return Object.assign({
      namespace: parameters.namespace || 'Alexa',
      name: parameters.name || 'Response',
      payloadVersion: this.directive.header.payloadVersion,
      messageId: uuid(),
    }, this.directive.header.correlationToken && {
      // Include correlationToken property if provided in directive header
      correlationToken: this.directive.header.correlationToken
    });
  }

  /**
   * Returns Alexa response
   * @param  {Object} response
   */
  returnAlexaResponse(response) {
    this.callback(null, response);
  }

  /**
   * Returns Alexa error response
   * @param  {Object} parameters  [namespace, payload]
   */
  returnAlexaErrorResponse(parameters = {}) {
    const response = this.generateResponse({
      header: {name: 'ErrorResponse', namespace: parameters.namespace},
      payload: parameters.payload
    });

    log.debug('returnAlexaErrorResponse done with response:', response);
    this.returnAlexaResponse(response);
  }

  /**
   * Returns Alexa generic error response
   * @param  {Object} error   [error object] (optional)
   */
  returnAlexaGenericErrorResponse(error = {}) {
    // Set default error response parameters
    const parameters = {payload: {
      type: 'ENDPOINT_UNREACHABLE',
      message: error.cause || 'Unable to reach device'
    }};

    // Set error status code to not found (404) if request error name
    if (error.name === 'RequestError') {
      error.statusCode = 404;
    }

    // Update error response parameters based on request error status code
    switch (error.statusCode) {
      case 400:
        Object.assign(parameters, {payload: {
          type: 'INVALID_VALUE',
          message: 'Invalid item command value'
        }});
        break;
      case 401:
        Object.assign(parameters, {payload: {
          type: 'INVALID_AUTHORIZATION_CREDENTIAL',
          message: 'Failed to authenticate'
        }});
        break;
      case 404:
        // Set to bridge unreachable when oh rest server not accessible, otherwise no such endpoint for items not found
        if (!error.response || !error.response.body || error.response.body.includes('Problem accessing')) {
          Object.assign(parameters, {payload: {
            type: 'BRIDGE_UNREACHABLE',
            message: 'Server not accessible'
          }});
        } else {
          Object.assign(parameters, {payload: {
            type: 'NO_SUCH_ENDPOINT',
            message: 'Item not found'
          }});
        }
        break;
    }

    // Return alexa error response
    this.returnAlexaErrorResponse(parameters);
  }
}

module.exports = AlexaResponse;