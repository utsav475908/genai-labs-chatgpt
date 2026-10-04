"use client";

import { useEffect, useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8019";

const MODELS = [
  "gpt-6-astra",
  "gpt-5.6-luna",
];

const OPERATIONS = [
  "chat",
  "coding",
  "security",
  "rag",
  "vision",
  "voice",
  "analysis",
  "generation",
];

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function formatLatency(value) {
  return `${Math.round(Number(value || 0))} ms`;
}

export default function Page() {
  const [model, setModel] = useState(MODELS[0]);
  const [operation, setOperation] = useState("chat");

  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");

  const [summary, setSummary] = useState({
    requests: 0,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    total_cost: 0,
    avg_latency: 0,
    successful: 0,
    failed: 0,
  });

  const [models, setModels] = useState([]);
  const [daily, setDaily] = useState([]);
  const [recent, setRecent] = useState([]);

  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setDashboardLoading(true);

    try {
      const [
        summaryResponse,
        modelsResponse,
        dailyResponse,
        recentResponse,
      ] = await Promise.all([
        fetch(`${BACKEND}/usage/summary`),
        fetch(`${BACKEND}/usage/models`),
        fetch(`${BACKEND}/usage/daily`),
        fetch(`${BACKEND}/usage/recent`),
      ]);

      const summaryData = await summaryResponse.json();
      const modelsData = await modelsResponse.json();
      const dailyData = await dailyResponse.json();
      const recentData = await recentResponse.json();

      setSummary(summaryData);
      setModels(modelsData.models || []);
      setDaily(dailyData.days || []);
      setRecent(recentData.requests || []);

    } catch (err) {
      setError(
        "Unable to load dashboard. Make sure the V19 backend is running on port 8019."
      );
    } finally {
      setDashboardLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const timer = setInterval(
      loadDashboard,
      10000
    );

    return () => clearInterval(timer);
  }, []);

  async function sendRequest() {
    if (!prompt.trim()) {
      setError("Enter a prompt first.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");

    try {
      const response = await fetch(
        `${BACKEND}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            model,
            operation,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Request failed."
        );
      }

      setAnswer(data.result || "");

      await loadDashboard();

    } catch (err) {
      setError(
        err.message ||
          "Unable to complete the request."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetDashboard() {
    const confirmed = window.confirm(
      "Delete all local V19 usage history?"
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${BACKEND}/usage/reset`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Could not reset usage.");
      }

      setAnswer("");
      await loadDashboard();

    } catch (err) {
      setError(err.message);
    }
  }

  const maxDailyCost = Math.max(
    ...daily.map((item) =>
      Number(item.cost || 0)
    ),
    0.000001
  );

  return (
    <main className="app-shell">

      {/* HEADER */}
      <header className="topbar">

        <div className="brand">

          <div className="brand-mark">
            G
          </div>

          <div>
            <div className="brand-name">
              GenAI-Labs
            </div>

            <div className="brand-subtitle">
              AI Usage & Cost Dashboard · V19
            </div>
          </div>

        </div>

        <div className="top-actions">

          <button
            className="top-button"
            onClick={loadDashboard}
          >
            ↻ Refresh
          </button>

          <button
            className="top-button danger-button"
            onClick={resetDashboard}
          >
            Reset Usage
          </button>

          <div className="status-pill">
            <span />
            Monitoring
          </div>

        </div>

      </header>


      <div className="workspace">

        {/* SIDEBAR */}
        <aside className="sidebar">

          <div className="side-title">
            AI USAGE LAB
          </div>

          <div className="side-label">
            MODEL
          </div>

          <select
            value={model}
            onChange={(event) =>
              setModel(event.target.value)
            }
          >
            {MODELS.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>


          <div className="side-label spaced">
            OPERATION
          </div>

          <select
            value={operation}
            onChange={(event) =>
              setOperation(event.target.value)
            }
          >
            {OPERATIONS.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>


          <div className="side-divider" />


          <div className="side-label">
            DASHBOARD
          </div>

          <div className="sidebar-item active">
            📊 Overview
          </div>

          <div className="sidebar-item">
            🤖 Models
          </div>

          <div className="sidebar-item">
            🪙 Tokens
          </div>

          <div className="sidebar-item">
            💰 Costs
          </div>

          <div className="sidebar-item">
            ⏱ Latency
          </div>

          <div className="sidebar-item">
            📋 Requests
          </div>


          <div className="sidebar-note">

            <strong>
              V19 Usage Logger
            </strong>

            <p>
              Requests made through this
              application are stored locally
              in SQLite.
            </p>

          </div>

        </aside>


        {/* MAIN */}
        <section className="main-panel">

          <div className="page-heading">

            <div>

              <div className="eyebrow">
                GENAI-LABS V19
              </div>

              <h1>
                AI Usage & Cost Dashboard
              </h1>

              <p>
                Monitor requests, tokens, estimated costs,
                models and response performance.
              </p>

            </div>

            <div className="live-indicator">
              <span />
              Live dashboard
            </div>

          </div>


          {/* KPI CARDS */}
          <div className="kpi-grid">

            <div className="kpi-card">

              <div className="kpi-icon">
                💰
              </div>

              <div>
                <small>
                  ESTIMATED COST
                </small>

                <strong>
                  {formatMoney(
                    summary.total_cost
                  )}
                </strong>

                <span>
                  Application usage
                </span>
              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon">
                📡
              </div>

              <div>
                <small>
                  REQUESTS
                </small>

                <strong>
                  {formatNumber(
                    summary.requests
                  )}
                </strong>

                <span>
                  {summary.successful} successful
                </span>
              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon">
                🪙
              </div>

              <div>
                <small>
                  TOTAL TOKENS
                </small>

                <strong>
                  {formatNumber(
                    summary.total_tokens
                  )}
                </strong>

                <span>
                  Input + output
                </span>
              </div>

            </div>


            <div className="kpi-card">

              <div className="kpi-icon">
                ⏱
              </div>

              <div>
                <small>
                  AVG LATENCY
                </small>

                <strong>
                  {formatLatency(
                    summary.avg_latency
                  )}
                </strong>

                <span>
                  API response time
                </span>
              </div>

            </div>

          </div>


          {/* TOP ROW */}
          <div className="dashboard-grid">


            {/* MODEL USAGE */}
            <div className="dashboard-card">

              <div className="card-heading">

                <div>
                  <strong>
                    Usage by Model
                  </strong>

                  <small>
                    Requests, tokens and estimated cost
                  </small>
                </div>

              </div>


              {models.length === 0 ? (

                <div className="empty-dashboard">
                  No usage recorded yet.
                </div>

              ) : (

                <div className="model-list">

                  {models.map((item) => (

                    <div
                      className="model-row"
                      key={item.model}
                    >

                      <div className="model-name">
                        <span className="model-dot" />
                        <strong>
                          {item.model}
                        </strong>
                      </div>

                      <div className="model-stat">
                        <small>
                          Requests
                        </small>
                        <b>
                          {formatNumber(
                            item.requests
                          )}
                        </b>
                      </div>

                      <div className="model-stat">
                        <small>
                          Tokens
                        </small>
                        <b>
                          {formatNumber(
                            item.total_tokens
                          )}
                        </b>
                      </div>

                      <div className="model-stat">
                        <small>
                          Cost
                        </small>
                        <b>
                          {formatMoney(
                            item.cost
                          )}
                        </b>
                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>


            {/* TOKEN BREAKDOWN */}
            <div className="dashboard-card">

              <div className="card-heading">

                <div>
                  <strong>
                    Token Breakdown
                  </strong>

                  <small>
                    Input vs output consumption
                  </small>
                </div>

              </div>


              <div className="token-summary">

                <div className="token-number">
                  <span>
                    Input
                  </span>

                  <strong>
                    {formatNumber(
                      summary.input_tokens
                    )}
                  </strong>
                </div>

                <div className="token-number">
                  <span>
                    Output
                  </span>

                  <strong>
                    {formatNumber(
                      summary.output_tokens
                    )}
                  </strong>
                </div>

              </div>


              <div className="token-bar">

                <div
                  style={{
                    width:
                      summary.total_tokens
                        ? `${Math.min(
                            100,
                            (summary.input_tokens /
                              summary.total_tokens) *
                              100
                          )}%`
                        : "0%",
                  }}
                />

              </div>


              <div className="token-legend">

                <span>
                  Input tokens
                </span>

                <span>
                  Output tokens
                </span>

              </div>


              <div className="success-row">

                <span>
                  Success rate
                </span>

                <strong>

                  {summary.requests
                    ? Math.round(
                        (summary.successful /
                          summary.requests) *
                          100
                      )
                    : 0}
                  %

                </strong>

              </div>

            </div>

          </div>


          {/* COST CHART */}
          <div className="dashboard-card chart-card">

            <div className="card-heading">

              <div>
                <strong>
                  Cost Over Time
                </strong>

                <small>
                  Estimated application cost per day
                </small>
              </div>

            </div>


            {daily.length === 0 ? (

              <div className="empty-dashboard chart-empty">
                Make your first API request to
                populate the usage chart.
              </div>

            ) : (

              <div className="chart">

                {daily.map((item) => {

                  const height =
                    Math.max(
                      5,
                      (Number(item.cost) /
                        maxDailyCost) *
                        100
                    );

                  return (

                    <div
                      className="chart-column"
                      key={item.day}
                    >

                      <div className="chart-value">
                        {formatMoney(item.cost)}
                      </div>

                      <div className="chart-bar-wrap">

                        <div
                          className="chart-bar"
                          style={{
                            height: `${height}%`,
                          }}
                        />

                      </div>

                      <div className="chart-label">
                        {item.day.slice(5)}
                      </div>

                    </div>

                  );

                })}

              </div>

            )}

          </div>


          {/* REQUEST TESTER */}
          <div className="dashboard-card tester-card">

            <div className="card-heading">

              <div>
                <strong>
                  Usage Test Console
                </strong>

                <small>
                  Send an API request and capture
                  its actual token usage.
                </small>
              </div>

              <span className="model-badge">
                {model}
              </span>

            </div>


            <textarea
              className="prompt-box"
              value={prompt}
              onChange={(event) =>
                setPrompt(event.target.value)
              }
              placeholder="Ask something to generate a real API request..."
            />


            <div className="tester-footer">

              <select
                value={operation}
                onChange={(event) =>
                  setOperation(event.target.value)
                }
              >

                {OPERATIONS.map((item) => (

                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>

                ))}

              </select>


              <button
                className="send-button"
                onClick={sendRequest}
                disabled={loading}
              >
                {loading
                  ? "Calling API..."
                  : "Send API Request"}
              </button>

            </div>


            {answer && (

              <div className="answer-box">

                <div className="answer-title">
                  API Response
                </div>

                <pre>
                  {answer}
                </pre>

              </div>

            )}

          </div>


          {/* RECENT REQUESTS */}
          <div className="dashboard-card recent-card">

            <div className="card-heading">

              <div>
                <strong>
                  Recent API Requests
                </strong>

                <small>
                  Latest activity recorded by V19
                </small>
              </div>

            </div>


            {recent.length === 0 ? (

              <div className="empty-dashboard">
                No API requests recorded.
              </div>

            ) : (

              <div className="table-wrap">

                <table>

                  <thead>

                    <tr>
                      <th>Time</th>
                      <th>Model</th>
                      <th>Operation</th>
                      <th>Tokens</th>
                      <th>Latency</th>
                      <th>Cost</th>
                      <th>Status</th>
                    </tr>

                  </thead>


                  <tbody>

                    {recent.map((item) => (

                      <tr key={item.id}>

                        <td>
                          {new Date(
                            item.timestamp
                          ).toLocaleTimeString()}
                        </td>

                        <td>
                          {item.model}
                        </td>

                        <td>
                          <span className="operation-pill">
                            {item.operation}
                          </span>
                        </td>

                        <td>
                          {formatNumber(
                            item.total_tokens
                          )}
                        </td>

                        <td>
                          {formatLatency(
                            item.latency_ms
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            item.cost
                          )}
                        </td>

                        <td>

                          <span
                            className={
                              item.success
                                ? "success-pill"
                                : "failed-pill"
                            }
                          >
                            {item.success
                              ? "Success"
                              : "Failed"}
                          </span>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}

          </div>


          {error && (

            <div className="error-box">
              <strong>
                Dashboard Error
              </strong>

              <p>
                {error}
              </p>
            </div>

          )}


          {dashboardLoading && (

            <div className="refresh-note">
              Updating dashboard...
            </div>

          )}

        </section>

      </div>

    </main>
  );
}