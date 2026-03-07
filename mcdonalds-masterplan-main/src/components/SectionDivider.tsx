import { motion } from "framer-motion";

const SectionDivider = () => (
  <motion.div
    initial={{ opacity: 0, scaleX: 0 }}
    whileInView={{ opacity: 1, scaleX: 1 }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    className="section-divider mx-auto max-w-4xl"
  />
);

export default SectionDivider;
