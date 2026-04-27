
-- Update platform_stats with fake but realistic metrics
UPDATE public.platform_stats SET stat_value = 12847 WHERE stat_key = 'total_annotations';
UPDATE public.platform_stats SET stat_value = 342 WHERE stat_key = 'active_annotators';
UPDATE public.platform_stats SET stat_value = 94 WHERE stat_key = 'avg_agreement_rate';
UPDATE public.platform_stats SET stat_value = 28 WHERE stat_key = 'datasets_delivered';
