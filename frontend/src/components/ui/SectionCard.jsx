/**
 * Card with the accent-bar section title, optional subtitle and a right-side action.
 *   <SectionCard title="Needs attention" action={<Link className="link">View all</Link>}>…</SectionCard>
 * Pass `flush` to let tables/lists run edge to edge under the header.
 */
const SectionCard = ({ title, subtitle, action, children, flush = false, className = '' }) => (
  <section className={`card flex flex-col ${className}`}>
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="section-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
    <div className={`flex-1 ${flush ? '' : 'px-5 pb-5'}`}>{children}</div>
  </section>
);

export default SectionCard;
