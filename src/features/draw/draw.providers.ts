import { randomInt } from "node:crypto";
import { createProviderToken } from "difunkt";
import type { RandomInt } from "./draw.types";

export const RandomIntToken = createProviderToken<RandomInt>("RandomInt");

// Cryptographically secure and unbiased, so draws cannot be predicted.
export const secureRandomInt: RandomInt = (min, max) => randomInt(min, max);
