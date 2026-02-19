using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SwimXpert.Api.Data;

namespace SwimXpert.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class AdminDashboardController(ApplicationDbContext dbContext) : ControllerBase
{
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview()
    {
        var totalClients = await dbContext.Users.CountAsync(u => u.Role != "Admin");
        var totalSwimmers = await dbContext.Swimmers.CountAsync();
        var totalSessions = await dbContext.TrainingSessions.CountAsync();
        var completedSessions = await dbContext.TrainingSessions.CountAsync(s => s.Status == "Completed");
        var cancelledSessions = await dbContext.TrainingSessions.CountAsync(s => s.Status == "Cancelled");

        var attendanceTotal = await dbContext.Attendances.CountAsync();
        var attendancePresent = await dbContext.Attendances.CountAsync(a => a.IsPresent);
        var attendanceRate = attendanceTotal == 0 ? 0 : Math.Round((double)attendancePresent / attendanceTotal * 100, 2);

        var totalRevenue = await dbContext.Payments
            .Where(p => p.Status == "Completed")
            .SumAsync(p => (decimal?)p.Amount) ?? 0m;

        return Ok(new
        {
            totalClients,
            totalSwimmers,
            totalSessions,
            completedSessions,
            cancelledSessions,
            attendanceRate,
            totalRevenue
        });
    }
}
