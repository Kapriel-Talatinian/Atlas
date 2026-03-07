using Atlas.Api.Services;
using Atlas.ToxicFlow;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ┌─────────────────────────────────────────────────────┐
// │  DI REGISTRATION                                     │
// │  Swap DemoDataService → your live data service       │
// │  to go from demo to production                       │
// └─────────────────────────────────────────────────────┘
builder.Services.AddSingleton<IMarketDataProvider, DemoDataService>();
builder.Services.AddSingleton<FlowClusterEngine>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.MapControllers();

app.Run();
