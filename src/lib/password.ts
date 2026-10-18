import bcrypt from "bcryptjs";

export const hashPassword = (plain: string) => {
  return bcrypt.hash(plain, 10);
};

export const verifyPassword = (plain: string, hashed: string) => {
  return bcrypt.compare(plain, hashed);
};
