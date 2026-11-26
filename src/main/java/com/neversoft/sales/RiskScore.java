package com.neversoft.sales;

import java.util.Objects;

/**
 * Immutable pairing of a {@link SalesOrder} with its risk score (1 to 10).
 * Produced by {@link SalesOrderRiskScorer#score}.
 *
 * @param order the scored order, never null
 * @param score the risk score, from 1 (lowest) to 10 (highest)
 */
public record RiskScore(SalesOrder order, int score) {

    public RiskScore {
        Objects.requireNonNull(order, "order");
        if (score < SalesOrderRiskScorer.MIN_SCORE || score > SalesOrderRiskScorer.MAX_SCORE) {
            throw new IllegalArgumentException(
                    "score must be between " + SalesOrderRiskScorer.MIN_SCORE + " and "
                            + SalesOrderRiskScorer.MAX_SCORE + " but was " + score);
        }
    }
}
