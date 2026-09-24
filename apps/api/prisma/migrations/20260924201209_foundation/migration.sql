-- CreateEnum
CREATE TYPE "ProductBody" AS ENUM ('CERAMIC', 'PORCELAIN');

-- CreateEnum
CREATE TYPE "ProductUse" AS ENUM ('WALL', 'FLOOR');

-- CreateEnum
CREATE TYPE "SurfaceFinish" AS ENUM ('GLOSSY', 'MATT', 'SATIN', 'POLISHED', 'STRUCTURED');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('BODY', 'GLAZE', 'COLOR', 'INK', 'CHEMICAL', 'PACKAGING');

-- CreateEnum
CREATE TYPE "MaterialUnit" AS ENUM ('TON', 'KG', 'LITER', 'PIECE', 'ROLL');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('BALL_MILL', 'SPRAY_DRYER', 'PRESS', 'DRYER', 'GLAZING_LINE', 'DIGITAL_PRINTER', 'KILN', 'SORTING_MACHINE', 'PACKING_MACHINE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('PREPARATION', 'PRESSING', 'DRYING', 'GLAZING', 'FIRING', 'SORTING', 'PACKING', 'WAREHOUSE');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(300),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "mfa_required" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "phone_enc" TEXT,
    "role_id" UUID NOT NULL,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret_enc" TEXT,
    "mfa_last_step" BIGINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "csrf_token" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "mfa_passed" BOOLEAN NOT NULL DEFAULT false,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" VARCHAR(40),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_name" VARCHAR(100),
    "action" VARCHAR(40) NOT NULL,
    "entity" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "prev_hash" CHAR(64) NOT NULL DEFAULT '',
    "hash" CHAR(64) NOT NULL DEFAULT '',

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_models" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "body" "ProductBody" NOT NULL,
    "use" "ProductUse" NOT NULL,
    "finish" "SurfaceFinish" NOT NULL,
    "notes" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "product_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sizes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "length_mm" INTEGER NOT NULL,
    "width_mm" INTEGER NOT NULL,
    "thickness_mm" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "code" VARCHAR(45) NOT NULL,
    "model_id" UUID NOT NULL,
    "size_id" UUID NOT NULL,
    "pieces_per_carton" INTEGER NOT NULL,
    "cartons_per_pallet" INTEGER NOT NULL,
    "sqm_per_carton" DECIMAL(10,4) NOT NULL,
    "sqm_per_pallet" DECIMAL(12,4) NOT NULL,
    "carton_weight_kg" DECIMAL(7,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shades" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "shades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "description" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "calibers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "unit" "MaterialUnit" NOT NULL,
    "min_stock" DECIMAL(14,3) NOT NULL,
    "lead_time_days" INTEGER NOT NULL,
    "notes" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lines" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "use" "ProductUse" NOT NULL,
    "body" "ProductBody" NOT NULL,
    "capacity_sqm_per_day" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "line_id" UUID,
    "notes" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(5) NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "start_time" CHAR(5) NOT NULL,
    "end_time" CHAR(5) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log"("actor_id");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- CreateIndex
CREATE UNIQUE INDEX "product_models_code_key" ON "product_models"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sizes_code_key" ON "sizes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_code_key" ON "product_variants"("code");

-- CreateIndex
CREATE INDEX "product_variants_size_id_idx" ON "product_variants"("size_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_model_id_size_id_key" ON "product_variants"("model_id", "size_id");

-- CreateIndex
CREATE UNIQUE INDEX "shades_code_key" ON "shades"("code");

-- CreateIndex
CREATE UNIQUE INDEX "calibers_code_key" ON "calibers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "materials_code_key" ON "materials"("code");

-- CreateIndex
CREATE UNIQUE INDEX "production_lines_code_key" ON "production_lines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_line_id_idx" ON "equipment"("line_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_code_key" ON "shifts"("code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "product_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "production_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
