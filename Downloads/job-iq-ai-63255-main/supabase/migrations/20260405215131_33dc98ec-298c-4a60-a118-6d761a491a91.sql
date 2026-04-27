ALTER TABLE certification_questions DROP CONSTRAINT IF EXISTS certification_questions_domain_check;
ALTER TABLE certification_questions ADD CONSTRAINT certification_questions_domain_check
  CHECK (domain IN ('medical','legal','finance','code','red_teaming'));

ALTER TABLE certification_gold_tasks DROP CONSTRAINT IF EXISTS certification_gold_tasks_domain_check;
ALTER TABLE certification_gold_tasks ADD CONSTRAINT certification_gold_tasks_domain_check
  CHECK (domain IN ('medical','legal','finance','code','red_teaming'));