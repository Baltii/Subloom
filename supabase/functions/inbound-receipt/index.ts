import { endpoint } from "../_shared/http.ts";
import { acknowledgeRetiredReceipt } from "../_shared/retired-receipt.ts";

export const handler = endpoint(acknowledgeRetiredReceipt);
Deno.serve(handler);
