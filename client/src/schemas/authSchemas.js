/**
 * Zod validation schemas for login and registration forms.
 *
 * Registration is now minimal — only email, password, name.
 * All profile data is collected dynamically during AI onboarding.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required"),
});

// ---------------------------------------------------------------------------
// Registration — static profile information: name, age, gender, height, current_weight, email, password
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(1, "Full name is required")
      .max(100, "Name must be at most 100 characters"),
    age: z
      .coerce
      .number({ invalid_type_error: "Age is required and must be a number" })
      .int("Age must be an integer")
      .min(1, "Age must be at least 1")
      .max(120, "Please enter a valid age"),
    gender: z
      .string()
      .min(1, "Gender is required"),
    height: z
      .coerce
      .number({ invalid_type_error: "Height is required and must be a number" })
      .positive("Height must be greater than 0")
      .max(300, "Please enter height in cm (max 300)"),
    current_weight: z
      .coerce
      .number({ invalid_type_error: "Current weight is required and must be a number" })
      .positive("Weight must be greater than 0")
      .max(500, "Please enter weight in kg (max 500)"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
