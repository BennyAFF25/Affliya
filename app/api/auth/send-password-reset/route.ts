import { createPasswordResetHandler } from "../../../../utils/auth/passwordResetHandler";
export const runtime = "nodejs";
export const POST = createPasswordResetHandler();
