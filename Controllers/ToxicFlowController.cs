using Atlas.Api.Services;
using Atlas.ToxicFlow;
using Atlas.ToxicFlow.Models;
using Microsoft.AspNetCore.Mvc;

namespace Atlas.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ToxicFlowController : ControllerBase
{
    private readonly IMarketDataProvider _data;
    private readonly FlowClusterEngine _clusterEngine;

    public ToxicFlowController(IMarketDataProvider data, FlowClusterEngine clusterEngine)
    {
        _data = data;
        _clusterEngine = clusterEngine;
    }

    /// <summary>Full toxic flow dashboard with clusters, counterparty profiles, and alerts.</summary>
    [HttpGet("dashboard")]
    public ActionResult<ToxicFlowDashboard> GetDashboard(int tradeCount = 200)
    {
        var trades = _data.GetRecentTrades(tradeCount);
        var dashboard = _clusterEngine.AnalyzeBatch(trades);
        return Ok(dashboard);
    }

    /// <summary>Get all flow clusters with summaries.</summary>
    [HttpGet("clusters")]
    public ActionResult<List<FlowCluster>> GetClusters(int tradeCount = 200)
    {
        var trades = _data.GetRecentTrades(tradeCount);
        var dashboard = _clusterEngine.AnalyzeBatch(trades);
        return Ok(dashboard.Clusters);
    }

    /// <summary>Get toxic counterparty profiles.</summary>
    [HttpGet("counterparties")]
    public ActionResult<List<CounterpartyProfile>> GetCounterparties(int tradeCount = 500)
    {
        var trades = _data.GetRecentTrades(tradeCount);
        var dashboard = _clusterEngine.AnalyzeBatch(trades);
        return Ok(dashboard.TopToxicCounterparties);
    }

    /// <summary>Get recent high-toxicity alerts.</summary>
    [HttpGet("alerts")]
    public ActionResult<List<EnrichedFlow>> GetAlerts(int tradeCount = 200)
    {
        var trades = _data.GetRecentTrades(tradeCount);
        var dashboard = _clusterEngine.AnalyzeBatch(trades);
        return Ok(dashboard.RecentAlerts);
    }

    /// <summary>Analyze a specific counterparty's flow pattern.</summary>
    [HttpGet("counterparty/{id}")]
    public ActionResult<CounterpartyProfile> AnalyzeCounterparty(string id, int tradeCount = 500)
    {
        var trades = _data.GetTradeHistory()
            .Where(t => t.CounterpartyId == id)
            .OrderByDescending(t => t.Timestamp)
            .Take(tradeCount)
            .ToList();

        if (trades.Count == 0) return NotFound();

        var dashboard = _clusterEngine.AnalyzeBatch(trades);
        var profile = dashboard.TopToxicCounterparties.FirstOrDefault()
            ?? new CounterpartyProfile(id, 0, 0, 0, 0, 0, 0, 0, 0,
                ToxicityLevel.Safe, FlowClusterType.Benign, []);
        return Ok(profile);
    }

    /// <summary>Full trade history with enrichment.</summary>
    [HttpGet("history")]
    public ActionResult GetHistory(int count = 100, string? counterparty = null)
    {
        var trades = _data.GetTradeHistory()
            .Where(t => counterparty == null || t.CounterpartyId == counterparty)
            .OrderByDescending(t => t.Timestamp)
            .Take(count)
            .ToList();

        var enriched = trades.Select(t => _clusterEngine.ClassifyTrade(t, trades)).ToList();
        return Ok(enriched);
    }
}
