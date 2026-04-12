import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { findOrCreateGoogleUser } from "../services/auth.service";
import { logger } from "../utils/logger";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateGoogleUser({
          googleId: profile.id,
          email: profile.emails?.[0]?.value || "",
          name: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value,
        });
        done(null, user);
      } catch (error) {
        logger.error({ error }, "Google OAuth error");
        done(error as Error);
      }
    },
  ),
);

export { passport };
