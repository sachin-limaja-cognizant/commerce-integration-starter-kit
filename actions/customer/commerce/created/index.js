/*
Copyright 2022 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const { telemetryConfig } = require('../../../telemetry')
const { instrumentEntrypoint, getInstrumentationHelpers } = require('@adobe/aio-lib-telemetry')

const { stringParameters } = require('../../../utils')
const { transformData } = require('./transformer')
const { sendData } = require('./sender')
const { HTTP_INTERNAL_ERROR, HTTP_BAD_REQUEST } = require('../../../constants')
const { validateData } = require('./validator')
const { preProcess } = require('./pre')
const { postProcess } = require('./post')
const { actionSuccessResponse, actionErrorResponse, isActionSuccessful } = require('../../../responses')

/**
 * This action is on charge of sending created customer information in Adobe commerce to external back-office application
 *
 * @returns {object} returns response object with status code, request data received and response of the invoked action
 * @param {object} params - includes the env params, type and the data of the event
 */
async function main (params) {
  const { logger } = getInstrumentationHelpers()

  logger.info('Start processing request')
  logger.debug(`Received params: ${stringParameters(params)}`)

  try {
    logger.debug(`Validate data: ${JSON.stringify(params.data)}`)
    const validation = validateData(params.data)
    if (!validation.success) {
      logger.error(`Validation failed with error: ${validation.message}`)
      return actionErrorResponse(HTTP_BAD_REQUEST, validation.message)
    }

    logger.debug(`Transform data: ${JSON.stringify(params.data)}`)
    const transformedData = transformData(params.data)

    logger.debug(`Preprocess data: ${stringParameters(params)}`)
    const preProcessed = preProcess(params, transformedData)

    logger.debug(`Start sending data: ${JSON.stringify(params)}`)
    const result = await sendData(params, transformedData, preProcessed)
    if (!result.success) {
      logger.error(`Send data failed: ${result.message}`)
      return actionErrorResponse(result.statusCode, result.message)
    }

    logger.debug(`Postprocess data: ${stringParameters(params)}`)
    postProcess(params, transformedData, preProcessed, result)

    logger.debug('Process finished successfully')
    return actionSuccessResponse('Customer created successfully')
  } catch (error) {
    logger.error(`Error processing the request: ${error.message}`)
    return actionErrorResponse(HTTP_INTERNAL_ERROR, error.message)
  }
}

exports.main = instrumentEntrypoint(main, {
  ...telemetryConfig,
  isSuccessful: isActionSuccessful
})
