package com.neversoft.sales;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * Stateless scorer that gives each {@link SalesOrder} a risk number from 1 to 10,
 * based on the order's value and its number of lines.
 * <p>
 * Rule:
 * <ol>
 *   <li>The value is the sum of the non-null {@code lineAmount}s of the order's lines
 *       (a null amount counts as zero). A negative total (for example from credits) is
 *       treated as zero.</li>
 *   <li>{@code valueScore} is 1 plus the number of {@link #VALUE_BOUNDS} that are
 *       less than or equal to the value.</li>
 *   <li>{@code lineScore} is 1 plus the number of {@link #LINE_BOUNDS} that are
 *       less than or equal to the line count.</li>
 *   <li>The score is the higher of the two, clamped to 1-10.</li>
 * </ol>
 * Bands are lower-inclusive: a bound is the lowest input that earns the next score.
 * <pre>
 * Score  Value from  Lines from
 *     1          0           0
 *     2        100           2
 *     3        500           4
 *     4       1000           6
 *     5       2500          10
 *     6       5000          15
 *     7      10000          20
 *     8      25000          30
 *     9      50000          50
 *    10     100000         100
 * </pre>
 * The bands are implementer defaults, not business-mandated numbers. They are defined
 * only by {@link #VALUE_BOUNDS} and {@link #LINE_BOUNDS}.
 * <p>
 * Scoring is per order, reads the order only and never mutates it.
 */
public final class SalesOrderRiskScorer {

    static final int MIN_SCORE = 1;
    static final int MAX_SCORE = 10;

    /** Ascending lower bounds of order value for scores 2 to 10. */
    static final List<BigDecimal> VALUE_BOUNDS = List.of(
            new BigDecimal("100"),
            new BigDecimal("500"),
            new BigDecimal("1000"),
            new BigDecimal("2500"),
            new BigDecimal("5000"),
            new BigDecimal("10000"),
            new BigDecimal("25000"),
            new BigDecimal("50000"),
            new BigDecimal("100000"));

    /** Ascending lower bounds of line count for scores 2 to 10. */
    static final List<Integer> LINE_BOUNDS = List.of(2, 4, 6, 10, 15, 20, 30, 50, 100);

    private SalesOrderRiskScorer() {
    }

    /**
     * Scores each order. The result has one {@link RiskScore} per input element, in
     * iteration order, and is immutable. Equal orders are not collapsed.
     *
     * @param orders the orders to score; null or empty gives an empty list
     * @return the scores in input order
     * @throws NullPointerException if an element of {@code orders} is null
     */
    public static List<RiskScore> score(Collection<SalesOrder> orders) {
        if (orders == null || orders.isEmpty()) {
            return List.of();
        }
        List<RiskScore> result = new ArrayList<>(orders.size());
        for (SalesOrder order : orders) {
            Objects.requireNonNull(order, "order");
            result.add(new RiskScore(order, scoreOrder(order)));
        }
        return List.copyOf(result);
    }

    static int scoreOrder(SalesOrder order) {
        int combined = Math.max(valueScore(orderValue(order)), lineScore(order.getLines().size()));
        return Math.min(MAX_SCORE, Math.max(MIN_SCORE, combined));
    }

    static BigDecimal orderValue(SalesOrder order) {
        BigDecimal total = BigDecimal.ZERO;
        for (SalesOrderLine line : order.getLines()) {
            BigDecimal amount = line.getLineAmount();
            if (amount != null) {
                total = total.add(amount);
            }
        }
        return total.signum() < 0 ? BigDecimal.ZERO : total;
    }

    static int valueScore(BigDecimal value) {
        int score = MIN_SCORE;
        for (BigDecimal bound : VALUE_BOUNDS) {
            if (bound.compareTo(value) <= 0) {
                score++;
            }
        }
        return score;
    }

    static int lineScore(int lineCount) {
        int score = MIN_SCORE;
        for (int bound : LINE_BOUNDS) {
            if (bound <= lineCount) {
                score++;
            }
        }
        return score;
    }
}
