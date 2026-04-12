using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Models;

namespace SwimXpert.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; } = null!;
    public DbSet<Swimmer> Swimmers { get; set; } = null!;
    public DbSet<TrainingSession> TrainingSessions { get; set; } = null!;
    public DbSet<Attendance> Attendances { get; set; } = null!;
    public DbSet<Payment> Payments { get; set; } = null!;
    public DbSet<LeadCapture> LeadCaptures { get; set; } = null!;
    public DbSet<ProgressEntry> ProgressEntries { get; set; } = null!;
    public DbSet<QuizResult> QuizResults { get; set; } = null!;
    public DbSet<RefreshToken> RefreshTokens { get; set; } = null!;
    public DbSet<AuditLog> AuditLogs { get; set; } = null!;
    public DbSet<GoogleCalendarState> GoogleCalendarStates { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Swimmer>()
            .HasOne(s => s.ParentUser)
            .WithMany(u => u.Swimmers)
            .HasForeignKey(s => s.ParentUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Attendance>()
            .HasOne(a => a.Swimmer)
            .WithMany(s => s.Attendances)
            .HasForeignKey(a => a.SwimmerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Attendance>()
            .HasOne(a => a.TrainingSession)
            .WithMany(t => t.Attendances)
            .HasForeignKey(a => a.TrainingSessionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Payment>()
            .HasOne(p => p.User)
            .WithMany(u => u.Payments)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TrainingSession>()
            .Property(t => t.Price)
            .HasPrecision(18, 2);

        modelBuilder.Entity<GoogleCalendarState>()
            .HasKey(x => x.Id);

        modelBuilder.Entity<LeadCapture>()
            .HasIndex(l => l.CreatedAt);

        modelBuilder.Entity<ProgressEntry>()
            .HasOne(p => p.Swimmer)
            .WithMany(s => s.ProgressEntries)
            .HasForeignKey(p => p.SwimmerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<QuizResult>()
            .HasOne(q => q.User)
            .WithMany(u => u.QuizResults)
            .HasForeignKey(q => q.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RefreshToken>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
