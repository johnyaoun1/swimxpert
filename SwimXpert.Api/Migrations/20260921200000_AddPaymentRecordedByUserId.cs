using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SwimXpert.Api.Data;

#nullable disable

namespace SwimXpert.Api.Migrations
{
    /// <summary>
    /// Adds Payments.RecordedByUserId. Idempotent so it is safe if startup SQL already added the column.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260921200000_AddPaymentRecordedByUserId")]
    public partial class AddPaymentRecordedByUserId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "Payments" ADD COLUMN IF NOT EXISTS "RecordedByUserId" integer;
                CREATE INDEX IF NOT EXISTS "IX_Payments_RecordedByUserId" ON "Payments" ("RecordedByUserId");
                ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "FK_Payments_Users_RecordedByUserId";
                ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Users_RecordedByUserId"
                    FOREIGN KEY ("RecordedByUserId") REFERENCES "Users" ("Id") ON DELETE SET NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE "Payments" DROP CONSTRAINT IF EXISTS "FK_Payments_Users_RecordedByUserId";
                DROP INDEX IF EXISTS "IX_Payments_RecordedByUserId";
                ALTER TABLE "Payments" DROP COLUMN IF EXISTS "RecordedByUserId";
                """);
        }
    }
}
