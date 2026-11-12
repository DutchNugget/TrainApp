ALTER TABLE "refresh_tokens" RENAME COLUMN "familyId" TO "family_id";--> statement-breakpoint
DROP INDEX "refresh_tokens_family_id_idx";--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" USING btree ("family_id");