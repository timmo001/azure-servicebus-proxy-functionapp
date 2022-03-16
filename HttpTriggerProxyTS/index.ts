import { Context, HttpRequest } from "@azure/functions";

import { defaultResponseHeaders } from "./util";
import { queueMessages } from "./queueMessages";
import { receiveMessages } from "./receiveMessages";
import type { Response } from "./types/response";

async function httpTrigger(context: Context, req: HttpRequest): Promise<void> {
  const { body, headers, method } = req;

  switch (method) {
    case "GET":
      await receiveMessages(context, req);
      break;
    case "POST":
      await queueMessages(context, req);
      break;
    default:
      const response: Response = {
        status: 405,
        headers: defaultResponseHeaders,
        body: {
          status: 405,
          message: `Method '${method} not allowed!`,
          request: { body, headers, method },
        },
      };
      context.log(JSON.stringify(response, undefined, 2));
      context.res = response;
      break;
  }
}

export default httpTrigger;
