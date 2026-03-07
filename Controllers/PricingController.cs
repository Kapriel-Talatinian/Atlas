using System.Diagnostics;
using Atlas.Core.Common;
using Atlas.Core.Models;
using Microsoft.AspNetCore.Mvc;

namespace Atlas.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PricingController : ControllerBase
{
    /// <summary>Price an option using all 5 models simultaneously.</summary>
    [HttpGet("compare")]
    public ActionResult<List<PricingResult>> CompareModels(
        double spot = 87250, double strike = 87000, double vol = 0.58,
        double tte = 30, double rate = 0.048, string type = "call",
        int mcPaths = 5000, int binSteps = 80)
    {
        var optType = type.ToLower() == "put" ? OptionType.Put : OptionType.Call;
        double T = tte / 365.25;
        var results = new List<PricingResult>();
        var sw = Stopwatch.StartNew();

        // 1. Black-Scholes
        sw.Restart();
        double bsPrice = BlackScholes.Price(spot, strike, vol, T, rate, optType);
        var bsGreeks = BlackScholes.AllGreeks(spot, strike, rate, vol, T, optType);
        results.Add(new PricingResult("Black-Scholes", bsPrice, vol,
            bsGreeks, DateTimeOffset.UtcNow, sw.Elapsed,
            new() { ["method"] = "Closed-form N(d₁), N(d₂)" }));

        // 2. Heston
        sw.Restart();
        double hPrice = HestonModel.Price(spot, strike, rate, Math.Sqrt(vol), T, optType);
        double hIv = ImpliedVolSolver.Solve(hPrice, spot, strike, rate, T, optType);
        results.Add(new PricingResult("Heston SV", hPrice, hIv,
            HestonModel.Greeks(spot, strike, rate, Math.Sqrt(vol), T, optType),
            DateTimeOffset.UtcNow, sw.Elapsed,
            new() { ["kappa"] = 3.0, ["theta"] = 0.40, ["xi"] = 0.80, ["rho"] = -0.65 }));

        // 3. Monte Carlo
        sw.Restart();
        double mcPrice = MonteCarlo.Price(spot, strike, rate, vol, T, optType, mcPaths);
        double mcIv = ImpliedVolSolver.Solve(mcPrice, spot, strike, rate, T, optType);
        results.Add(new PricingResult("Monte Carlo", mcPrice, mcIv,
            bsGreeks, DateTimeOffset.UtcNow, sw.Elapsed,
            new() { ["paths"] = mcPaths, ["method"] = "GBM + antithetic" }));

        // 4. Binomial
        sw.Restart();
        double binPrice = BinomialTree.PriceRichardson(spot, strike, rate, vol, T, optType, binSteps);
        double binIv = ImpliedVolSolver.Solve(binPrice, spot, strike, rate, T, optType);
        results.Add(new PricingResult("Binomial CRR", binPrice, binIv,
            bsGreeks, DateTimeOffset.UtcNow, sw.Elapsed,
            new() { ["steps"] = binSteps, ["method"] = "CRR + Richardson" }));

        // 5. SABR
        sw.Restart();
        double sabrPrice = SabrModel.Price(spot, strike, rate, vol, T, optType);
        double sabrIv = ImpliedVolSolver.Solve(sabrPrice, spot, strike, rate, T, optType);
        results.Add(new PricingResult("SABR", sabrPrice, sabrIv,
            bsGreeks, DateTimeOffset.UtcNow, sw.Elapsed,
            new() { ["alpha"] = vol * 0.8, ["beta"] = 0.5, ["rho"] = -0.35, ["nu"] = 0.55 }));

        return Ok(results);
    }

    /// <summary>Compute Greeks for a single option.</summary>
    [HttpGet("greeks")]
    public ActionResult<GreeksResult> GetGreeks(
        double spot = 87250, double strike = 87000, double vol = 0.58,
        double tte = 30, double rate = 0.048, string type = "call")
    {
        var optType = type.ToLower() == "put" ? OptionType.Put : OptionType.Call;
        double T = tte / 365.25;
        return Ok(BlackScholes.AllGreeks(spot, strike, rate, vol, T, optType));
    }

    /// <summary>Extract implied vol from a market price.</summary>
    [HttpGet("implied-vol")]
    public ActionResult<double> GetImpliedVol(
        double price, double spot = 87250, double strike = 87000,
        double tte = 30, double rate = 0.048, string type = "call")
    {
        var optType = type.ToLower() == "put" ? OptionType.Put : OptionType.Call;
        double T = tte / 365.25;
        return Ok(ImpliedVolSolver.Solve(price, spot, strike, rate, T, optType));
    }
}
