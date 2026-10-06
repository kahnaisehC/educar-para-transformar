#!/usr/bin/env python3
"""
Calcula métricas de productividad a partir del historial real de git:

- Deployment Frequency (proxy): commits a main por semana.
- Lead Time (proxy): horas transcurridas entre commits consecutivos a main
  (en ausencia de CI/PR, es el único rastro disponible del "tiempo hasta
  que un cambio queda integrado").

No requiere credenciales ni acceso a la API de GitHub: corre sobre el
propio repositorio local.

Uso:
    python3 scripts/metrics/git_metrics.py
"""
import subprocess
import statistics
from datetime import datetime, timezone


def get_commits(branch="main"):
    out = subprocess.check_output(
        ["git", "log", "--format=%H|%ad", "--date=iso-strict", branch],
        text=True,
    ).strip().splitlines()
    commits = []
    for line in out:
        sha, date_str = line.split("|", 1)
        commits.append((sha, datetime.fromisoformat(date_str)))
    commits.sort(key=lambda c: c[1])
    return commits


def deployment_frequency(commits):
    if len(commits) < 2:
        return None
    start = commits[0][1]
    end = commits[-1][1]
    weeks = max((end - start).total_seconds() / (3600 * 24 * 7), 1 / 7)
    return len(commits) / weeks


def lead_times_hours(commits):
    deltas = []
    for (_, t0), (_, t1) in zip(commits, commits[1:]):
        deltas.append((t1 - t0).total_seconds() / 3600)
    return deltas


def main():
    commits = get_commits("main")
    freq = deployment_frequency(commits)
    deltas = lead_times_hours(commits)

    print(f"Commits analizados en main: {len(commits)}")
    print(f"Rango: {commits[0][1].date()} -> {commits[-1][1].date()}")
    print()
    print(f"Deployment Frequency (proxy, commits/semana a main): {freq:.2f}")
    if deltas:
        print(f"Lead Time promedio entre integraciones (horas): {statistics.mean(deltas):.1f}")
        print(f"Lead Time mediana (horas): {statistics.median(deltas):.1f}")
        print(f"Lead Time máximo (horas): {max(deltas):.1f}")
        print(f"Lead Time mínimo (horas): {min(deltas):.1f}")


if __name__ == "__main__":
    main()
